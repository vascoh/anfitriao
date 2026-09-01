import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

/**
 * Duplo da base de dados que **respeita os filtros**.
 *
 * Um duplo que devolve sempre a mesma linha faria os testes de propriedade
 * passar sem provar nada: o guarda existe precisamente para distinguir a
 * linha de um anfitrião da de outro, e isso só se vê se o `eq('id', …)` for
 * levado a sério.
 */
const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; row: Record<string, unknown> }> = []

type Linha = Record<string, unknown>

function construtor(tabela: string) {
  /* Os filtros passaram a predicados em vez de pares coluna/valor: a
   * verificação de sobreposição usa `lt`/`gt`/`neq`/`not…in`, e um duplo que
   * só saiba fazer `eq` deixaria passar exatamente o teste que interessa —
   * daria "sem conflito" sempre, e o guarda parecia bom sem nunca correr. */
  const filtros: Array<(l: Linha) => boolean> = []
  let tecto: number | null = null

  const alvo = () => {
    const r = (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))
    return tecto === null ? r : r.slice(0, tecto)
  }

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    neq: (c: string, v: unknown) => { filtros.push(l => l[c] !== v); return obj },
    lt: (c: string, v: unknown) => { filtros.push(l => (l[c] as string) < (v as string)); return obj },
    gt: (c: string, v: unknown) => { filtros.push(l => (l[c] as string) > (v as string)); return obj },
    /** Só a forma que o código usa: `not(coluna, 'in', '("a","b")')`. */
    not: (c: string, op: string, v: string) => {
      if (op === 'in') {
        const proibidos = v.replace(/[()"]/g, '').split(',').map(s => s.trim())
        filtros.push(l => !proibidos.includes(String(l[c])))
      }
      return obj
    },
    limit: (n: number) => { tecto = n; return obj },
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    single: async () => {
      const linha = alvo()[0]
      return linha ? { data: linha, error: null } : { data: null, error: { message: 'not found' } }
    },
    order: () => obj,
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      upsert: async (row: Record<string, unknown>) => {
        escritas.push({ tabela, row })
        return { error: null }
      },
      delete: () => construtor(tabela),
    }),
  }),
}))

let utilizador: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: utilizador }),
}))

const { POST } = await import('./route')

function pedido(corpo: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

const RESERVA = {
  id: 'b-nova',
  propriedade_id: 'p-minha',
  hospede_id: 'g-meu',
  check_in: '2026-09-01',
  check_out: '2026-09-04',
  num_hospedes: 2,
  estado: 'confirmada',
  preco_total: 300,
}

beforeEach(() => {
  utilizador = 'user_1'
  escritas.length = 0
  tabelas.properties = [
    { id: 'p-minha', owner_id: 'user_1' },
    { id: 'p-do-vizinho', owner_id: 'user_2' },
    { id: 'p-sem-dono', owner_id: null },
  ]
  tabelas.guests = [
    { id: 'g-meu', owner_id: 'user_1' },
    { id: 'g-do-vizinho', owner_id: 'user_2' },
  ]
  tabelas.bookings = [
    { id: 'b-minha', owner_id: 'user_1' },
    { id: 'b-do-vizinho', owner_id: 'user_2' },
    // Ocupa 10 a 15 de setembro em p-minha — a régua dos testes de conflito.
    {
      id: 'b-ocupada', owner_id: 'user_1', propriedade_id: 'p-minha',
      check_in: '2026-09-10', check_out: '2026-09-15', estado: 'confirmada',
    },
  ]
})

describe('POST /api/bookings', () => {
  it('cria uma reserva no alojamento do próprio', async () => {
    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(200)
    expect(escritas[0].row.owner_id).toBe('user_1')
  })

  it('recusa reservar uma casa que tem quartos ativos', async () => {
    /* Uma casa com quartos é o contentor deles, não uma unidade alugável
     * (`unidadesReservaveis`). `/reservas/nova` já não a oferece; a regra
     * faltava no servidor, que é onde vale para o separador que ficou aberto
     * antes de o primeiro quarto existir. A reserva ficava invisível — nenhum
     * ecrã a mostra — e não bloqueava os quartos, que continuavam a ser
     * vendidos nas mesmas datas. */
    tabelas.properties.push({ id: 'q-1', owner_id: 'user_1', parent_id: 'p-minha', ativo: true })

    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(400)
    expect(escritas).toHaveLength(0)
  })

  it('um quarto desativado não impede reservar a casa', async () => {
    tabelas.properties.push({ id: 'q-1', owner_id: 'user_1', parent_id: 'p-minha', ativo: false })

    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(200)
  })

  it('recusa reservar no alojamento de outro anfitrião', async () => {
    /* O id de uma propriedade é público — está no URL de /book/[id]. Sem este
     * guarda, uma conta grátis bloqueava o calendário do vizinho: o
     * `hasConflict` procura por propriedade e não por dono, e ele não via
     * nada, porque o calendário dele só mostra as reservas dele. */
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-do-vizinho' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })

  it('recusa uma propriedade que não existe', async () => {
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-inventada' }))
    expect(res.status).toBe(404)
  })

  it('aceita uma propriedade sem dono (legado)', async () => {
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-sem-dono' }))
    expect(res.status).toBe(200)
  })

  it('recusa sobrepor a reserva de outro anfitrião', async () => {
    const res = await POST(pedido({ ...RESERVA, id: 'b-do-vizinho' }))
    expect(res.status).toBe(403)
    expect(escritas).toHaveLength(0)
  })

  it('deixa alterar uma reserva própria', async () => {
    const res = await POST(pedido({ ...RESERVA, id: 'b-minha' }))
    expect(res.status).toBe(200)
  })

  it('recusa ligar a ficha de um hóspede de outro anfitrião', async () => {
    // Uma reserva não empresta o acesso aos dados de quem é cliente de outro.
    const res = await POST(pedido({ ...RESERVA, hospede_id: 'g-do-vizinho' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })

  it('o owner_id é sempre o da sessão, não o que vier no corpo', async () => {
    const res = await POST(pedido({ ...RESERVA, owner_id: 'user_2' }))
    expect(res.status).toBe(200)
    expect(escritas[0].row.owner_id).toBe('user_1')
  })

  it('sem sessão não escreve nada', async () => {
    utilizador = null
    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(401)
    expect(escritas).toHaveLength(0)
  })

  it('JSON inválido não rebenta a rota', async () => {
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: 'isto não é json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

/**
 * Dupla reserva.
 *
 * A verificação vivia só no browser, em `/reservas/nova`, sobre a lista que a
 * página tinha em mão. Editar as datas de uma reserva não tinha verificação
 * nenhuma — nem no browser. Estes testes existem para que não volte a ser
 * possível gravar duas reservas em cima uma da outra por caminho nenhum.
 */
describe('POST /api/bookings — sobreposição de datas', () => {
  const NOVA = { ...RESERVA, id: 'b-nova', propriedade_id: 'p-minha' }

  it('recusa datas que caem dentro de uma reserva existente', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-11', check_out: '2026-09-13' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'CONFLITO' })
    expect(escritas).toHaveLength(0)
  })

  it('recusa quando engole a reserva existente por inteiro', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-01', check_out: '2026-09-30' }))
    expect(res.status).toBe(409)
  })

  it('recusa quando só a entrada cai lá dentro', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-14', check_out: '2026-09-20' }))
    expect(res.status).toBe(409)
  })

  /* Intervalos meio-abertos: quem sai no dia 10 liberta a cama para quem entra
   * no dia 10. Tratar isto como conflito recusaria metade das reservas
   * legítimas de uma casa cheia. */
  it('deixa entrar no dia em que a outra sai', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-15', check_out: '2026-09-18' }))
    expect(res.status).toBe(200)
  })

  it('deixa sair no dia em que a outra entra', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-05', check_out: '2026-09-10' }))
    expect(res.status).toBe(200)
  })

  it('uma reserva não choca consigo mesma ao ser editada', async () => {
    const res = await POST(pedido({
      ...NOVA, id: 'b-ocupada', check_in: '2026-09-10', check_out: '2026-09-16',
    }))
    expect(res.status).toBe(200)
  })

  it('cancelar não é bloqueado pelas datas que a própria reserva ocupa', async () => {
    const res = await POST(pedido({
      ...NOVA, check_in: '2026-09-11', check_out: '2026-09-13', estado: 'cancelada',
    }))
    expect(res.status).toBe(200)
  })

  it('uma reserva cancelada não bloqueia as datas de outra', async () => {
    tabelas.bookings = [{
      id: 'b-cancelada', owner_id: 'user_1', propriedade_id: 'p-minha',
      check_in: '2026-09-10', check_out: '2026-09-15', estado: 'cancelada',
    }]
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-11', check_out: '2026-09-13' }))
    expect(res.status).toBe(200)
  })

  it('datas noutro alojamento não chocam', async () => {
    const res = await POST(pedido({
      ...NOVA, propriedade_id: 'p-sem-dono', check_in: '2026-09-11', check_out: '2026-09-13',
    }))
    expect(res.status).toBe(200)
  })

  /* A porta de saída para quem sabe o que está a fazer: corrigir dados
   * antigos, ou um caso em que a sobreposição é real e intencional. É preciso
   * pedi-la — não acontece por omissão. */
  it('permite sobrepor quando é pedido explicitamente', async () => {
    const res = await POST(pedido({
      ...NOVA, check_in: '2026-09-11', check_out: '2026-09-13', permitir_sobreposicao: true,
    }))
    expect(res.status).toBe(200)
    // A bandeira é de controlo, não uma coluna — não pode ir para a base.
    expect(escritas[0].row).not.toHaveProperty('permitir_sobreposicao')
  })

  it('recusa saída antes da entrada', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-20', check_out: '2026-09-18' }))
    expect(res.status).toBe(400)
    expect(escritas).toHaveLength(0)
  })

  it('recusa entrada e saída no mesmo dia', async () => {
    const res = await POST(pedido({ ...NOVA, check_in: '2026-09-20', check_out: '2026-09-20' }))
    expect(res.status).toBe(400)
  })
})
