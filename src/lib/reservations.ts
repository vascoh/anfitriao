import type { Booking, BookingStatus, BookingEvent, Property, PriceRule, Tarifa, PlatformRate, PricingBreakdown, BookingSource } from './types'
import { nights } from './utils'

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (cur < end) {
    dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}

export function blockedDates(bookings: Booking[], propertyId: string, excludeId?: string): Set<string> {
  const set = new Set<string>()
  bookings
    .filter(b =>
      b.propriedade_id === propertyId &&
      b.estado !== 'cancelada' &&
      b.estado !== 'no_show' &&
      b.id !== excludeId
    )
    .forEach(b => dateRange(b.check_in, b.check_out).forEach(d => set.add(d)))
  return set
}

export function detectConflict(
  bookings: Booking[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string
): Booking | null {
  return bookings.find(b =>
    b.propriedade_id === propertyId &&
    b.estado !== 'cancelada' &&
    b.estado !== 'no_show' &&
    b.id !== excludeId &&
    b.check_in < checkOut &&
    b.check_out > checkIn
  ) ?? null
}

export function isAvailable(
  bookings: Booking[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string
): boolean {
  return detectConflict(bookings, propertyId, checkIn, checkOut, excludeId) === null
}

export interface PricingResult {
  nightlyRate: number
  numNights: number
  total: number
}

export function calculatePrice(property: Property, checkIn: string, checkOut: string): PricingResult {
  const numNights = nights(checkIn, checkOut)
  return {
    nightlyRate: property.preco_base,
    numNights,
    total: property.preco_base * numNights,
  }
}

// Determine if a price rule applies to a given check-in date
function ruleAppliesToDate(rule: PriceRule, date: string): boolean {
  if (rule.data_inicio && date < rule.data_inicio) return false
  if (rule.data_fim && date > rule.data_fim) return false
  if (rule.dias_semana && rule.dias_semana.length > 0) {
    const dow = new Date(date + 'T00:00:00').getDay()
    if (!rule.dias_semana.includes(dow)) return false
  }
  return true
}

// Find the highest-priority active rule that applies to a stay
function findBestRule(rules: PriceRule[], checkIn: string, numNights: number): PriceRule | null {
  const active = rules.filter(r => r.ativo)
  if (active.length === 0) return null

  // A rule applies to a stay if it matches the check-in date AND satisfies length-of-stay constraints
  const matching = active.filter(r => {
    if (!ruleAppliesToDate(r, checkIn)) return false
    if (r.min_noites && numNights < r.min_noites) return false
    if (r.max_noites && numNights > r.max_noites) return false
    return true
  })

  if (matching.length === 0) return null
  // Sort by priority desc, then by specificity (date range set > no date range)
  matching.sort((a, b) => {
    if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade
    const aHasDates = (a.data_inicio || a.data_fim) ? 1 : 0
    const bHasDates = (b.data_inicio || b.data_fim) ? 1 : 0
    return bHasDates - aHasDates
  })
  return matching[0]
}

// Find best tariff for a booking
function findBestTarifa(tarifas: Tarifa[], origem: BookingSource, numNights: number): Tarifa | null {
  const active = tarifas.filter(t => t.ativo)
  const matching = active.filter(t => {
    if (t.plataformas && t.plataformas.length > 0 && !t.plataformas.includes(origem)) return false
    if (numNights < t.min_noites) return false
    if (t.max_noites && numNights > t.max_noites) return false
    return true
  })
  if (matching.length === 0) return null
  // Prefer most specific (with plataformas set)
  matching.sort((a, b) => {
    const aHasPlat = (a.plataformas && a.plataformas.length > 0) ? 1 : 0
    const bHasPlat = (b.plataformas && b.plataformas.length > 0) ? 1 : 0
    return bHasPlat - aHasPlat
  })
  return matching[0]
}

export function calculatePriceWithRules(
  property: Property,
  checkIn: string,
  checkOut: string,
  rules: PriceRule[] = [],
  tarifas: Tarifa[] = [],
  platformRates: PlatformRate[] = [],
  origem: BookingSource = 'direto',
): PricingBreakdown {
  const numNoites = nights(checkIn, checkOut)
  const rule = findBestRule(rules.filter(r => r.property_id === property.id), checkIn, numNoites)
  const tarifa = findBestTarifa(tarifas.filter(t => t.property_id === property.id), origem, numNoites)
  const platformRate = platformRates.find(r => r.property_id === property.id && r.plataforma === origem && r.ativo)

  // Base nightly rate
  let precoNoite = rule?.preco_noite ?? property.preco_base

  // Apply rule percentage adjustment
  const descontoPct = rule?.desconto_pct ?? 0
  if (descontoPct !== 0) {
    precoNoite = precoNoite * (1 + descontoPct / 100)
  }

  // Cleaning fee
  const taxaLimpeza = rule?.taxa_limpeza ?? property.taxa_limpeza ?? 0

  const subtotalNoites = precoNoite * numNoites

  // Tariff adjustment
  const tarifaDescontoPct = tarifa?.desconto_pct ?? 0
  const tarifaSuplemento = tarifa?.suplemento_valor ?? 0
  const ajusteValor = (subtotalNoites * tarifaDescontoPct) / 100 + tarifaSuplemento

  // Platform multiplier
  const multiplicador = platformRate?.multiplicador ?? 1.0
  const baseBeforePlatform = subtotalNoites + ajusteValor + taxaLimpeza
  const plataformaAjuste = baseBeforePlatform * (multiplicador - 1)

  const total = Math.round((baseBeforePlatform + plataformaAjuste) * 100) / 100

  return {
    preco_noite: Math.round(precoNoite * 100) / 100,
    num_noites: numNoites,
    subtotal_noites: Math.round(subtotalNoites * 100) / 100,
    taxa_limpeza: taxaLimpeza,
    ajuste_pct: tarifaDescontoPct,
    ajuste_valor: Math.round(ajusteValor * 100) / 100,
    plataforma_multiplicador: multiplicador,
    plataforma_ajuste: Math.round(plataformaAjuste * 100) / 100,
    total,
    regra_aplicada: rule?.nome,
    tarifa_aplicada: tarifa?.nome,
  }
}

// Get price for a specific day (used by calendar view)
export function getPriceForDay(
  property: Property,
  date: string,
  rules: PriceRule[],
): { preco: number; regra?: string } {
  const propRules = rules.filter(r => r.property_id === property.id && r.ativo)
  const rule = findBestRule(propRules, date, 1)
  let preco = rule?.preco_noite ?? property.preco_base
  if (rule?.desconto_pct) preco = preco * (1 + rule.desconto_pct / 100)
  return { preco: Math.round(preco), regra: rule?.nome }
}

export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pendente:  ['confirmada', 'cancelada'],
  confirmada: ['checkin', 'cancelada', 'no_show'],
  checkin:   ['checkout'],
  checkout:  [],
  cancelada: [],
  no_show:   [],
}

const TRANSITION_LABELS: Partial<Record<BookingStatus, string>> = {
  confirmada: 'Reserva confirmada',
  checkin:    'Check-in realizado',
  checkout:   'Check-out realizado',
  cancelada:  'Reserva cancelada',
  no_show:    'No-show registado',
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function availableActions(status: BookingStatus): BookingStatus[] {
  return STATUS_TRANSITIONS[status] ?? []
}

export function transitionBooking(booking: Booking, to: BookingStatus, nota?: string): Booking {
  if (!canTransition(booking.estado, to)) {
    throw new Error(`Transição inválida: ${booking.estado} → ${to}`)
  }
  const event: BookingEvent = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    tipo: to as BookingEvent['tipo'],
    descricao: nota ?? TRANSITION_LABELS[to] ?? `Estado: ${to}`,
  }
  return { ...booking, estado: to, historico: [...(booking.historico ?? []), event] }
}

export function bookingsByProperty(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>()
  bookings.forEach(b => {
    const list = map.get(b.propriedade_id) ?? []
    list.push(b)
    map.set(b.propriedade_id, list)
  })
  return map
}

export function occupancyForMonth(
  bookings: Booking[],
  propertyId: string,
  year: number,
  month: number
): { occupied: number; total: number; pct: number } {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  // Use the first day of the next month as the exclusive upper bound so that
  // the last night of the month (e.g. May 31 → June 1) is counted correctly.
  const nextMonthStart = month === 11
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 2).padStart(2, '0')}-01`

  const occupied = bookings
    .filter(b =>
      b.propriedade_id === propertyId &&
      b.estado !== 'cancelada' &&
      b.estado !== 'no_show' &&
      b.check_in < nextMonthStart &&
      b.check_out > monthStart
    )
    .reduce((acc, b) => {
      const start = b.check_in > monthStart ? b.check_in : monthStart
      const end = b.check_out < nextMonthStart ? b.check_out : nextMonthStart
      return acc + Math.max(0, Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000))
    }, 0)

  return { occupied, total: daysInMonth, pct: Math.round((occupied / daysInMonth) * 100) }
}
