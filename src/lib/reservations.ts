import type { Booking, BookingStatus, BookingEvent, Property } from './types'
import { nights } from './store'

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + n)
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
