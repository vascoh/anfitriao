import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
// `contas.ts` instancia o cliente Supabase ao ser importado. Estes testes só
// exercitam as funções puras — o acesso a dados é coberto em produção pelas
// rotas, não aqui.
vi.mock('../supabase', () => ({ createAdminClient: () => ({}) }))

const { contaPronta, paraPublica } = await import('./contas')
const { pedidoDaNotaCredito, linhasDaNotaCredito, linhasDaReserva } = await import('./mapping')

type Conta = Parameters<typeof paraPublica>[0]

const CONTA: Conta = {
  id: 'c1',
  owner_id: 'user_1',
  fornecedor: 'invoicexpress',
  conta: 'casadovasco',
  conta_id: '999',
  api_key: 'v1.aaa.bbb.ccc',
  nome_fiscal: 'Casa do Vasco',
  nif: '123456789',
  at_estado: 'configurada',
  at_erro: null,
  at_configurada_em: '2026-08-03T10:00:00Z',
  serie_id: '55',
  serie_nome: 'ANF2026',
  estado: 'ativa',
  emissao_automatica: true,
  criado_em: '2026-08-03T09:00:00Z',
}

describe('contaPronta', () => {
  it('está pronta com AT configurada, série e conta ativa', () => {
    expect(contaPronta(CONTA)).toBe(true)
  })

  it('não está pronta sem série — sem série não há numeração legal', () => {
    expect(contaPronta({ ...CONTA, serie_id: null })).toBe(false)
  })

  it('não está pronta sem a AT ligada', () => {
    expect(contaPronta({ ...CONTA, at_estado: 'por_configurar' })).toBe(false)
    expect(contaPronta({ ...CONTA, at_estado: 'falhou' })).toBe(false)
  })

  it('não está pronta se a conta estiver suspensa', () => {
    expect(contaPronta({ ...CONTA, estado: 'suspensa' })).toBe(false)
  })
})

describe('paraPublica', () => {
  it('nunca deixa sair a chave da conta', () => {
    const publica = paraPublica(CONTA) as Record<string, unknown>
    expect(publica.api_key).toBeUndefined()
    expect(JSON.stringify(publica)).not.toContain('v1.aaa')
  })

  it('não deixa sair o dono', () => {
    expect((paraPublica(CONTA) as Record<string, unknown>).owner_id).toBeUndefined()
  })

  it('mantém o que a interface precisa, e diz se está pronta', () => {
    const publica = paraPublica(CONTA)
    expect(publica).toMatchObject({
      conta: 'casadovasco',
      nome_fiscal: 'Casa do Vasco',
      serie_nome: 'ANF2026',
      pronta: true,
    })
  })
})

describe('linhasDaNotaCredito', () => {
  it('anula exatamente o que foi faturado', () => {
    const originais = linhasDaReserva(
      { alojamento: 300, limpeza: 40, taxaTuristica: 12 },
      'Lisboa',
      '3 noites',
    )
    const nota = linhasDaNotaCredito(originais)
    expect(nota).toEqual(originais)
  })

  it('devolve cópias, para não haver partilha de referências entre documentos', () => {
    const originais = linhasDaReserva({ alojamento: 100 }, 'Porto', 'x')
    const nota = linhasDaNotaCredito(originais)
    nota[0].precoUnitario = 1
    expect(originais[0].precoUnitario).not.toBe(1)
  })
})

describe('pedidoDaNotaCredito', () => {
  const propriedade = {
    id: 'p1', nome: 'Casa do Vale', tipo: 'apartamento' as const, endereco: 'Rua A',
    cidade: 'Lisboa', capacidade: 4, quartos: 2, casasBanho: 1, comodidades: [],
    instrucoes_checkin: '', regras_casa: '', preco_base: 100, cor: '#000',
    ativo: true, criado_em: '2026-01-01',
  }
  const reserva = {
    id: 'b1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: '2026-08-01', check_out: '2026-08-04', num_hospedes: 2,
    estado: 'cancelada' as const, origem: 'direto' as const,
    preco_total: 400, preco_pago: 400, criado_em: '2026-07-01', historico: [],
    fatura_numero: 'FR 2026/12',
  }

  it('é uma nota de crédito e refere a fatura que anula', () => {
    const p = pedidoDaNotaCredito(reserva, propriedade, null, { alojamento: 400 })
    expect(p.tipo).toBe('credit_note')
    expect(p.referencia).toBe('Anula FR 2026/12')
  })

  it('não é enviada ao hóspede por omissão', () => {
    const p = pedidoDaNotaCredito(reserva, propriedade, null, { alojamento: 400 })
    expect(p.enviarPorEmail).toBe(false)
  })

  it('regista o motivo', () => {
    const p = pedidoDaNotaCredito(reserva, propriedade, null, { alojamento: 400 }, {
      motivo: 'Cancelamento pelo hóspede',
    })
    expect(p.observacoes).toBe('Cancelamento pelo hóspede')
  })
})
