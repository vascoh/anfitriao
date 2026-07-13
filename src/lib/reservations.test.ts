import { describe, it, expect } from 'vitest'
import {
  addDays,
  dateRange,
  blockedDates,
  detectConflict,
  isAvailable,
  calculatePrice,
  calculatePriceWithRules,
  getPriceForDay,
  canTransition,
  availableActions,
  transitionBooking,
  bookingsByProperty,
  occupancyForMonth,
} from './reservations'
import type { Booking, Property, PriceRule, Tarifa, PlatformRate } from './types'

function mkBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: over.id ?? crypto.randomUUID(),
    propriedade_id: 'prop-1',
    hospede_id: 'guest-1',
    check_in: '2026-08-10',
    check_out: '2026-08-15',
    num_hospedes: 2,
    estado: 'confirmada',
    origem: 'direto',
    preco_total: 500,
    preco_pago: 0,
    criado_em: '2026-07-01T00:00:00Z',
    historico: [],
    ...over,
  }
}

const PROPERTY: Property = {
  id: 'prop-1',
  nome: 'Casa do Mar',
  tipo: 'apartamento',
  endereco: 'Rua A',
  cidade: 'Lisboa',
  capacidade: 4,
  quartos: 2,
  casasBanho: 1,
  comodidades: [],
  instrucoes_checkin: '',
  regras_casa: '',
  preco_base: 100,
  taxa_limpeza: 30,
  cor: '#C2714F',
  ativo: true,
  criado_em: '2026-01-01T00:00:00Z',
}

function mkRule(over: Partial<PriceRule> = {}): PriceRule {
  return {
    id: crypto.randomUUID(),
    property_id: 'prop-1',
    nome: 'Regra',
    tipo: 'custom',
    prioridade: 0,
    ativo: true,
    criado_em: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('dateRange / addDays', () => {
  it('produces half-open range [start, end)', () => {
    expect(dateRange('2026-08-10', '2026-08-13')).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
  })

  it('returns empty when start >= end', () => {
    expect(dateRange('2026-08-10', '2026-08-10')).toEqual([])
    expect(dateRange('2026-08-11', '2026-08-10')).toEqual([])
  })

  it('addDays works in UTC across boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('blockedDates / detectConflict / isAvailable', () => {
  const bookings = [
    mkBooking({ id: 'b1', check_in: '2026-08-10', check_out: '2026-08-15' }),
    mkBooking({ id: 'b2', check_in: '2026-08-20', check_out: '2026-08-22', estado: 'cancelada' }),
    mkBooking({ id: 'b3', propriedade_id: 'prop-2', check_in: '2026-08-10', check_out: '2026-08-12' }),
  ]

  it('blocks nights of active bookings only (checkout day free)', () => {
    const blocked = blockedDates(bookings, 'prop-1')
    expect(blocked.has('2026-08-10')).toBe(true)
    expect(blocked.has('2026-08-14')).toBe(true)
    expect(blocked.has('2026-08-15')).toBe(false) // checkout day is free
    expect(blocked.has('2026-08-20')).toBe(false) // cancelled booking
  })

  it('excludes a booking by id (editing an existing booking)', () => {
    const blocked = blockedDates(bookings, 'prop-1', 'b1')
    expect(blocked.size).toBe(0)
  })

  it('detects overlap with half-open interval semantics', () => {
    // back-to-back: new check-in on existing check-out day is allowed
    expect(detectConflict(bookings, 'prop-1', '2026-08-15', '2026-08-18')).toBeNull()
    // ends exactly at existing check-in is allowed
    expect(detectConflict(bookings, 'prop-1', '2026-08-08', '2026-08-10')).toBeNull()
    // overlapping one night conflicts
    expect(detectConflict(bookings, 'prop-1', '2026-08-14', '2026-08-16')?.id).toBe('b1')
    // fully containing conflicts
    expect(detectConflict(bookings, 'prop-1', '2026-08-01', '2026-08-30')?.id).toBe('b1')
  })

  it('ignores cancelled/no_show and other properties', () => {
    expect(isAvailable(bookings, 'prop-1', '2026-08-20', '2026-08-22')).toBe(true)
    expect(isAvailable(bookings, 'prop-2', '2026-08-10', '2026-08-12')).toBe(false)
  })
})

describe('calculatePrice', () => {
  it('multiplies base price by nights', () => {
    expect(calculatePrice(PROPERTY, '2026-08-10', '2026-08-13')).toEqual({
      nightlyRate: 100,
      numNights: 3,
      total: 300,
    })
  })
})

describe('calculatePriceWithRules', () => {
  it('uses base price + cleaning fee with no rules', () => {
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12')
    expect(r.preco_noite).toBe(100)
    expect(r.subtotal_noites).toBe(200)
    expect(r.taxa_limpeza).toBe(30)
    expect(r.total).toBe(230)
  })

  it('applies a seasonal rule price override within its date range', () => {
    const rules = [mkRule({ nome: 'Verão', preco_noite: 150, data_inicio: '2026-08-01', data_fim: '2026-08-31' })]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(r.preco_noite).toBe(150)
    expect(r.regra_aplicada).toBe('Verão')
    expect(r.total).toBe(330)
  })

  it('does not apply a rule outside its date range', () => {
    const rules = [mkRule({ preco_noite: 150, data_inicio: '2026-08-01', data_fim: '2026-08-05' })]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(r.preco_noite).toBe(100)
    expect(r.regra_aplicada).toBeUndefined()
  })

  it('picks the highest-priority matching rule', () => {
    const rules = [
      mkRule({ nome: 'Base+', preco_noite: 110, prioridade: 1 }),
      mkRule({ nome: 'Promo', preco_noite: 90, prioridade: 5 }),
    ]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(r.regra_aplicada).toBe('Promo')
    expect(r.preco_noite).toBe(90)
  })

  it('applies percentage adjustment from a rule', () => {
    const rules = [mkRule({ nome: 'Desconto', desconto_pct: -10 })]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(r.preco_noite).toBe(90)
  })

  it('respects weekday filters (dias_semana)', () => {
    // 2026-08-10 is a Monday (getDay() === 1)
    const weekend = [mkRule({ nome: 'Fim de semana', preco_noite: 200, dias_semana: [5, 6] })]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', weekend)
    expect(r.preco_noite).toBe(100)
    const monday = [mkRule({ nome: 'Segunda', preco_noite: 80, dias_semana: [1] })]
    const r2 = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', monday)
    expect(r2.preco_noite).toBe(80)
  })

  it('respects min/max nights on rules', () => {
    const rules = [mkRule({ nome: 'Longa', preco_noite: 70, min_noites: 7 })]
    const short = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(short.preco_noite).toBe(100)
    const long = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-17', rules)
    expect(long.preco_noite).toBe(70)
  })

  it('ignores inactive rules and rules for other properties', () => {
    const rules = [
      mkRule({ preco_noite: 10, ativo: false }),
      mkRule({ preco_noite: 20, property_id: 'prop-2' }),
    ]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', rules)
    expect(r.preco_noite).toBe(100)
  })

  it('applies tariff discount and supplement', () => {
    const tarifas: Tarifa[] = [{
      id: 't1', property_id: 'prop-1', nome: 'Não reembolsável', tipo: 'non_refundable',
      desconto_pct: -10, suplemento_valor: 5, min_noites: 1, ativo: true, criado_em: '2026-01-01',
    }]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', [], tarifas)
    // subtotal 200, ajuste = 200 * -10% + 5 = -15, cleaning 30 → 215
    expect(r.ajuste_valor).toBe(-15)
    expect(r.total).toBe(215)
    expect(r.tarifa_aplicada).toBe('Não reembolsável')
  })

  it('applies platform multiplier on top of everything', () => {
    const rates: PlatformRate[] = [{
      id: 'r1', property_id: 'prop-1', plataforma: 'booking',
      multiplicador: 1.15, comissao_pct: 15, ativo: true, criado_em: '2026-01-01',
    }]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', [], [], rates, 'booking')
    // (200 + 30) * 1.15 = 264.5
    expect(r.plataforma_ajuste).toBe(34.5)
    expect(r.total).toBe(264.5)
  })

  it('does not apply platform rate for a different platform', () => {
    const rates: PlatformRate[] = [{
      id: 'r1', property_id: 'prop-1', plataforma: 'booking',
      multiplicador: 1.15, comissao_pct: 15, ativo: true, criado_em: '2026-01-01',
    }]
    const r = calculatePriceWithRules(PROPERTY, '2026-08-10', '2026-08-12', [], [], rates, 'direto')
    expect(r.total).toBe(230)
  })
})

describe('getPriceForDay', () => {
  it('returns rule price for matching day', () => {
    const rules = [mkRule({ nome: 'Agosto', preco_noite: 150, data_inicio: '2026-08-01', data_fim: '2026-08-31' })]
    expect(getPriceForDay(PROPERTY, '2026-08-10', rules)).toEqual({ preco: 150, regra: 'Agosto' })
    expect(getPriceForDay(PROPERTY, '2026-09-10', rules)).toEqual({ preco: 100, regra: undefined })
  })
})

describe('booking status transitions', () => {
  it('enforces the state machine', () => {
    expect(canTransition('pendente', 'confirmada')).toBe(true)
    expect(canTransition('pendente', 'checkin')).toBe(false)
    expect(canTransition('confirmada', 'checkin')).toBe(true)
    expect(canTransition('checkin', 'checkout')).toBe(true)
    expect(canTransition('checkout', 'confirmada')).toBe(false)
    expect(canTransition('cancelada', 'confirmada')).toBe(false)
  })

  it('availableActions matches the transition table', () => {
    expect(availableActions('confirmada')).toEqual(['checkin', 'cancelada', 'no_show'])
    expect(availableActions('checkout')).toEqual([])
  })

  it('transitionBooking appends a history event', () => {
    const b = mkBooking({ estado: 'pendente' })
    const next = transitionBooking(b, 'confirmada')
    expect(next.estado).toBe('confirmada')
    expect(next.historico).toHaveLength(1)
    expect(next.historico[0].tipo).toBe('confirmada')
    // original untouched
    expect(b.estado).toBe('pendente')
    expect(b.historico).toHaveLength(0)
  })

  it('transitionBooking throws on invalid transition', () => {
    const b = mkBooking({ estado: 'checkout' })
    expect(() => transitionBooking(b, 'checkin')).toThrow(/Transição inválida/)
  })
})

describe('bookingsByProperty', () => {
  it('groups bookings by property id', () => {
    const map = bookingsByProperty([
      mkBooking({ id: 'a', propriedade_id: 'p1' }),
      mkBooking({ id: 'b', propriedade_id: 'p1' }),
      mkBooking({ id: 'c', propriedade_id: 'p2' }),
    ])
    expect(map.get('p1')?.map(b => b.id)).toEqual(['a', 'b'])
    expect(map.get('p2')).toHaveLength(1)
  })
})

describe('occupancyForMonth', () => {
  it('counts nights inside the month only', () => {
    const bookings = [mkBooking({ check_in: '2026-08-10', check_out: '2026-08-15' })]
    const r = occupancyForMonth(bookings, 'prop-1', 2026, 7) // August (0-indexed)
    expect(r.occupied).toBe(5)
    expect(r.total).toBe(31)
    expect(r.pct).toBe(16)
  })

  it('clips bookings that span month boundaries', () => {
    const bookings = [mkBooking({ check_in: '2026-07-30', check_out: '2026-08-03' })]
    const july = occupancyForMonth(bookings, 'prop-1', 2026, 6)
    const august = occupancyForMonth(bookings, 'prop-1', 2026, 7)
    expect(july.occupied).toBe(2) // nights of Jul 30, 31
    expect(august.occupied).toBe(2) // nights of Aug 1, 2 (checkout morning of the 3rd)
  })

  it('counts the last night of the month (May 31 → June 1)', () => {
    const bookings = [mkBooking({ check_in: '2026-05-31', check_out: '2026-06-01' })]
    expect(occupancyForMonth(bookings, 'prop-1', 2026, 4).occupied).toBe(1)
  })

  it('handles December year rollover', () => {
    const bookings = [mkBooking({ check_in: '2026-12-30', check_out: '2027-01-02' })]
    expect(occupancyForMonth(bookings, 'prop-1', 2026, 11).occupied).toBe(2)
  })

  it('excludes cancelled bookings', () => {
    const bookings = [mkBooking({ check_in: '2026-08-10', check_out: '2026-08-15', estado: 'cancelada' })]
    expect(occupancyForMonth(bookings, 'prop-1', 2026, 7).occupied).toBe(0)
  })
})
