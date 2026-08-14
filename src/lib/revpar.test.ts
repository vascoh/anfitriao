import { describe, it, expect } from 'vitest'
import { calcularRevPar, diasDoPeriodo, eBissexto, diasDoMes } from './revpar'
import type { Booking, Property } from './types'

const PROP: Property = {
  id: 'p1', nome: 'T1', tipo: 'apartamento', endereco: '', cidade: 'Lisboa',
  capacidade: 2, quartos: 1, casasBanho: 1, comodidades: [],
  instrucoes_checkin: '', regras_casa: '', preco_base: 100, cor: '#000',
  ativo: true, criado_em: '2026-01-01',
} as Property

function reserva(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: '2026-01-05', check_out: '2026-01-08',
    num_hospedes: 2, estado: 'confirmada', origem: 'direto',
    preco_total: 300, preco_pago: 300, criado_em: '2026-01-01', historico: [],
    ...over,
  } as Booking
}

describe('eBissexto', () => {
  it('segue a regra gregoriana, não `ano % 4`', () => {
    expect(eBissexto(2024)).toBe(true)
    expect(eBissexto(2026)).toBe(false)
    expect(eBissexto(1900)).toBe(false) // o `% 4` dizia que sim
    expect(eBissexto(2000)).toBe(true)
  })
})

describe('diasDoMes', () => {
  it('fevereiro conhece os bissextos', () => {
    expect(diasDoMes(2026, 1)).toBe(28)
    expect(diasDoMes(2024, 1)).toBe(29)
    expect(diasDoMes(2026, 0)).toBe(31)
    expect(diasDoMes(2026, 3)).toBe(30)
  })
})

describe('diasDoPeriodo', () => {
  it('um ano passado conta inteiro', () => {
    expect(diasDoPeriodo(2025, '2026-03-10')).toBe(365)
    expect(diasDoPeriodo(2024, '2026-03-10')).toBe(366)
  })

  it('o ano em curso conta só até hoje', () => {
    expect(diasDoPeriodo(2026, '2026-01-20')).toBe(20)
    expect(diasDoPeriodo(2026, '2026-03-01')).toBe(31 + 28 + 1)
  })

  it('um ano futuro não tem dias decorridos', () => {
    expect(diasDoPeriodo(2027, '2026-03-10')).toBe(0)
  })

  it('com mês, conta o mês inteiro', () => {
    expect(diasDoPeriodo(2026, '2026-01-20', 0)).toBe(31)
  })
})

describe('calcularRevPar', () => {
  it('receita a dividir pelas noites disponíveis', () => {
    // 300 € numa unidade × 10 dias decorridos = 30 €/noite disponível.
    const r = calcularRevPar({
      bookings: [reserva()],
      properties: [PROP],
      ano: 2026,
      hoje: '2026-01-10',
    })
    expect(r).toBe(30)
  })

  it('uma reserva futura não entra no ano em curso', () => {
    /* Era o bug: o denominador contava os dias já passados e o numerador
     * somava o ano inteiro. Em janeiro, uma reserva de dezembro já paga
     * dividida por 20 dias dava um RevPAR várias vezes acima do real — no
     * mês em que o anfitrião está a decidir os preços da época. */
    const r = calcularRevPar({
      bookings: [reserva({ id: 'b2', check_in: '2026-12-01', check_out: '2026-12-08', preco_total: 700 })],
      properties: [PROP],
      ano: 2026,
      hoje: '2026-01-20',
    })
    expect(r).toBe(0)
  })

  it('num ano já terminado conta tudo', () => {
    const r = calcularRevPar({
      bookings: [reserva({ check_in: '2025-06-01', check_out: '2025-06-04', preco_total: 365 })],
      properties: [PROP],
      ano: 2025,
      hoje: '2026-01-20',
    })
    expect(r).toBe(1) // 365 € / 365 noites
  })

  it('ignora canceladas e no-shows', () => {
    const r = calcularRevPar({
      bookings: [
        reserva({ estado: 'cancelada' }),
        reserva({ id: 'b2', estado: 'no_show' }),
      ],
      properties: [PROP],
      ano: 2026,
      hoje: '2026-01-10',
    })
    expect(r).toBe(0)
  })

  it('a casa-mãe não entra nas noites disponíveis nem na receita', () => {
    // Uma casa com quartos é o contentor deles: conta 1 unidade (o quarto),
    // não 2. Se entrasse no denominador, o RevPAR vinha diluído a metade.
    const casa = { ...PROP, id: 'casa', nome: 'Casa' } as Property
    const quarto = { ...PROP, id: 'q1', nome: 'Quarto', parent_id: 'casa' } as Property

    const r = calcularRevPar({
      bookings: [reserva({ propriedade_id: 'q1', preco_total: 300 })],
      properties: [casa, quarto],
      ano: 2026,
      hoje: '2026-01-10',
    })
    expect(r).toBe(30)
  })

  it('sem unidades alugáveis devolve zero em vez de dividir por zero', () => {
    expect(calcularRevPar({ bookings: [reserva()], properties: [], ano: 2026, hoje: '2026-01-10' })).toBe(0)
  })

  it('um ano futuro devolve zero em vez de infinito', () => {
    expect(calcularRevPar({
      bookings: [reserva({ check_in: '2027-05-01' })],
      properties: [PROP],
      ano: 2027,
      hoje: '2026-01-10',
    })).toBe(0)
  })
})
