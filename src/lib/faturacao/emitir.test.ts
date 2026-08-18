import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Motor de emissão de faturas.
 *
 * É o sítio onde um erro **não se desfaz**: o documento é comunicado à AT e o
 * único caminho para trás é uma nota de crédito. Duas coisas têm de ser
 * verdade sempre — não se emitem dois documentos para a mesma estadia, e o
 * dinheiro repartido por um grupo tem de somar o total, nem mais nem menos.
 */

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; dados: Record<string, unknown>; filtros: Array<[string, unknown]> }> = []

function construtor(tabela: string, dadosUpdate?: Record<string, unknown>) {
  const filtros: Array<[string, unknown]> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(([c, v]) => l[c] === v))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push([c, v]); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push([c, vs[0]]); return obj },
    order: () => obj,
    select: () => obj,
    maybeSingle: async () => {
      if (dadosUpdate) {
        const linhas = alvo()
        // Um update só "reserva" o direito se encontrar linha com o estado lido.
        if (linhas.length === 0) return { data: null, error: null }
        escritas.push({ tabela, dados: dadosUpdate, filtros: [...filtros] })
        linhas.forEach(l => Object.assign(l, dadosUpdate))
        return { data: linhas[0], error: null }
      }
      return { data: alvo()[0] ?? null, error: null }
    },
    single: async () => ({ data: alvo()[0] ?? null, error: null }),
    then: (r: (v: { data: unknown; error: null }) => unknown) => {
      if (dadosUpdate) {
        const linhas = alvo()
        escritas.push({ tabela, dados: dadosUpdate, filtros: [...filtros] })
        linhas.forEach(l => Object.assign(l, dadosUpdate))
        return r({ data: linhas, error: null })
      }
      return r({ data: alvo(), error: null })
    },
  }
  return obj
}

vi.mock('../supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      update: (dados: Record<string, unknown>) => construtor(tabela, dados),
    }),
  }),
}))

vi.mock('../campos-sensiveis', () => ({ revelarCampos: (l: unknown) => l }))

/** Conta de faturação do anfitrião — uma por anfitrião, no NIF dele. */
let conta: unknown = {
  conta: { id: 'c1', serie_id: 's1', at_estado: 'ativa', estado: 'ativa', emissao_automatica: true },
  credenciais: { apiKey: 'k', conta: 'casa' },
}
vi.mock('./contas', () => ({
  contaComCredenciais: async () => conta,
  contaPronta: () => true,
}))

/** O que foi pedido ao fornecedor. */
const pedidos: Array<Record<string, unknown>> = []
let respostaFornecedor: Record<string, unknown> = {
  sucesso: true, idExterno: 'fx-1', numero: 'FR 2026/1',
  atcud: 'ABC-1', urlPdf: 'https://x/1.pdf', total: 300,
}

/* O adaptador tem **um** método `emitir` que despacha pelo `tipo` do pedido
 * (`invoice_receipt` → `/invoice_receipts`, `credit_note` → `/credit_notes`).
 * O duplo tem de fazer o mesmo, senão testa uma API que não existe. */
vi.mock('./index', () => ({
  getInvoicingAdapter: () => ({
    emitir: async (_c: unknown, pedido: Record<string, unknown>) => {
      pedidos.push(pedido)
      return pedido.tipo === 'credit_note'
        ? { sucesso: true, idExterno: 'nc-1', numero: 'NC 2026/1', atcud: 'NC-1', total: 300 }
        : respostaFornecedor
    },
  }),
}))

const { emitirFaturaDaReserva, emitirNotaCredito } = await import('./emitir')

const PROPRIEDADE = { id: 'p1', nome: 'Casa de Vasco', cidade: 'Amora', taxa_limpeza: 30, owner_id: 'user_1' }

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', owner_id: 'user_1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: '2026-07-01', check_out: '2026-07-04', num_hospedes: 2,
    estado: 'checkout', preco_total: 300, fatura_estado: 'nao_emitida',
    reserva_grupo_id: null, ...over,
  }
}

beforeEach(() => {
  escritas.length = 0
  pedidos.length = 0
  respostaFornecedor = {
    sucesso: true, idExterno: 'fx-1', numero: 'FR 2026/1',
    atcud: 'ABC-1', urlPdf: 'https://x/1.pdf', total: 300,
  }
  conta = {
    conta: { id: 'c1', serie_id: 's1', at_estado: 'ativa', estado: 'ativa', emissao_automatica: true },
    credenciais: { apiKey: 'k', conta: 'casa' },
  }
  tabelas.bookings = [reserva()]
  tabelas.properties = [PROPRIEDADE]
  tabelas.guests = [{ id: 'g1', nome: 'Maria Silva', email: 'maria@exemplo.pt', nif: '123456789' }]
})

describe('emitirFaturaDaReserva', () => {
  it('emite e grava número, ATCUD e link', async () => {
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(true)

    const final = tabelas.bookings[0]
    expect(final.fatura_estado).toBe('emitida')
    expect(final.fatura_numero).toBe('FR 2026/1')
    expect(final.fatura_atcud).toBe('ABC-1')
  })

  it('o NIF da fatura vem do campo do NIF, nunca do documento', async () => {
    /* O Cartão de Cidadão não é o NIF: o que ia para a AT era recusado, ou
     * pior, atribuído ao número fiscal de um desconhecido. */
    tabelas.guests[0] = { id: 'g1', nome: 'Maria', numero_documento: '12345678 9 ZZ4', nif: undefined }
    await emitirFaturaDaReserva('user_1', 'b1')
    expect((pedidos[0].cliente as Record<string, unknown>).nif).toBeNull()
  })

  it('não emite duas vezes para a mesma reserva', async () => {
    // A transição de estado é condicionada: o botão e o cron em simultâneo
    // só deixam passar um.
    tabelas.bookings[0].fatura_estado = 'emitida'
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('não emite uma reserva cancelada', async () => {
    tabelas.bookings[0].estado = 'cancelada'
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('não emite valor zero', async () => {
    tabelas.bookings[0].preco_total = 0
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('sem conta de faturação não tenta emitir', async () => {
    conta = null
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('não emite a reserva de outro anfitrião', async () => {
    const r = await emitirFaturaDaReserva('user_2', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('uma falha do fornecedor deixa a reserva marcada, não emitida', async () => {
    respostaFornecedor = { sucesso: false, erro: 'NIF inválido' }
    const r = await emitirFaturaDaReserva('user_1', 'b1')

    expect(r.ok).toBe(false)
    expect(tabelas.bookings[0].fatura_estado).toBe('falhou')
    expect(tabelas.bookings[0].fatura_erro).toBe('NIF inválido')
  })

  it('a linha da taxa turística sai isenta de IVA', async () => {
    // Não é sujeita (art. 2.º n.º 2 do CIVA): misturá-la com o alojamento
    // inflacionaria o IVA liquidado.
    const linhas = pedidos.length === 0
      ? (await emitirFaturaDaReserva('user_1', 'b1'), pedidos[0].linhas)
      : pedidos[0].linhas
    const taxa = (linhas as Array<Record<string, unknown>>).find(l => String(l.nome).includes('turística'))
    if (taxa) expect(taxa.taxaIva).toBe(0)
  })
})

describe('emitirNotaCredito', () => {
  beforeEach(() => {
    tabelas.bookings[0] = reserva({
      fatura_estado: 'emitida', fatura_id_externo: 'fx-1',
      fatura_numero: 'FR 2026/1', fatura_total: 300,
    })
  })

  it('anula uma fatura emitida', async () => {
    const r = await emitirNotaCredito('user_1', 'b1', 'cancelamento')
    expect(r.ok).toBe(true)
    expect(tabelas.bookings[0].nota_credito_numero).toBe('NC 2026/1')
  })

  it('não anula o que não foi emitido', async () => {
    /* Não se apaga nem se reemite: a numeração já foi comunicada à AT, e o
     * único caminho legal para trás é um documento que a anule. */
    tabelas.bookings[0] = reserva({ fatura_estado: 'nao_emitida' })
    const r = await emitirNotaCredito('user_1', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('não anula a fatura de outro anfitrião', async () => {
    const r = await emitirNotaCredito('user_2', 'b1')
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })
})

/**
 * Sexta pergunta da série: **o que fica para trás quando falha a meio?**
 *
 * A reserva de estado protegia contra emissão dupla, mas nada a libertava: uma
 * falha entre reservar e guardar o resultado deixava a reserva em `a_emitir`
 * para sempre — o botão a responder "aguarda" durante meses e o cron a saltá-la
 * por a confundir com uma corrida normal.
 */
describe('emissões que ficaram a meio', () => {
  it('uma emissão a decorrer diz para aguardar', async () => {
    tabelas.bookings = [reserva({
      fatura_estado: 'a_emitir',
      fatura_reservada_em: new Date().toISOString(),
    })]
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('a_emitir')
  })

  it('uma emissão parada há muito diz outra coisa', async () => {
    tabelas.bookings = [reserva({
      fatura_estado: 'a_emitir',
      fatura_reservada_em: new Date(Date.now() - 60 * 60_000).toISOString(),
    })]
    const r = await emitirFaturaDaReserva('user_1', 'b1')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('presa')
      // A mensagem manda verificar antes de repetir: a fatura pode ter saído.
      expect(r.erro).toMatch(/fornecedor/i)
    }
  })

  it('a hora da reserva fica guardada ao reservar', async () => {
    await emitirFaturaDaReserva('user_1', 'b1')
    const reservou = escritas.find(e => e.dados.fatura_estado === 'a_emitir')
    expect(reservou?.dados.fatura_reservada_em).toBeTruthy()
  })

  it('emitida com sucesso, a hora da reserva é limpa', async () => {
    await emitirFaturaDaReserva('user_1', 'b1')
    const emitiu = escritas.find(e => e.dados.fatura_estado === 'emitida')
    expect(emitiu?.dados.fatura_reservada_em).toBeNull()
  })

  it('recusada pelo fornecedor, também é limpa — senão ficava presa na mesma', async () => {
    respostaFornecedor = { sucesso: false, erro: 'NIF inválido' }
    await emitirFaturaDaReserva('user_1', 'b1')
    const falhou = escritas.find(e => e.dados.fatura_estado === 'falhou')
    expect(falhou?.dados.fatura_reservada_em).toBeNull()
  })
})
