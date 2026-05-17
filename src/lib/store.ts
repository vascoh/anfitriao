import type { Property, Guest, Booking, WebsiteSettings } from './types'
import { mockProperties, mockGuests, mockBookings } from './mock-data'

const K = {
  props: 'anf:properties',
  guests: 'anf:guests',
  bookings: 'anf:bookings',
  seeded: 'anf:seeded',
  website: 'anf:website',
}

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: false,
  nome: 'Reservas Diretas',
  descricao: 'Reserve diretamente connosco sem taxas de intermediários.',
  email: '',
  telefone: '',
  min_noites: 2,
  antecedencia_dias: 1,
}

function seed() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(K.seeded)) return
  localStorage.setItem(K.props, JSON.stringify(mockProperties))
  localStorage.setItem(K.guests, JSON.stringify(mockGuests))
  localStorage.setItem(K.bookings, JSON.stringify(mockBookings))
  localStorage.setItem(K.seeded, '1')
}

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  seed()
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

function write<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

function upsert<T extends { id: string }>(key: string, item: T) {
  const all = read<T>(key)
  const i = all.findIndex(x => x.id === item.id)
  if (i >= 0) { all[i] = item } else { all.unshift(item) }
  write(key, all)
}

export const store = {
  getProperties: (): Property[] => read(K.props),
  saveProperty: (p: Property) => upsert(K.props, p),
  deleteProperty: (id: string) => write(K.props, read<Property>(K.props).filter(x => x.id !== id)),

  getGuests: (): Guest[] => read(K.guests),
  saveGuest: (g: Guest) => upsert(K.guests, g),

  getBookings: (): Booking[] => read(K.bookings),
  saveBooking: (b: Booking) => upsert(K.bookings, b),
  deleteBooking: (id: string) => write(K.bookings, read<Booking>(K.bookings).filter(x => x.id !== id)),

  getWebsiteSettings: (): WebsiteSettings => {
    if (typeof window === 'undefined') return DEFAULT_WEBSITE
    try { return JSON.parse(localStorage.getItem(K.website) || 'null') ?? DEFAULT_WEBSITE }
    catch { return DEFAULT_WEBSITE }
  },
  saveWebsiteSettings: (s: WebsiteSettings) => {
    localStorage.setItem(K.website, JSON.stringify(s))
  },

  reset: () => {
    localStorage.removeItem(K.seeded)
    seed()
  },
}

export function uuid(): string {
  return crypto.randomUUID()
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export function nights(check_in: string, check_out: string): number {
  const a = parseDate(check_in)
  const b = parseDate(check_out)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-PT', opts ?? { day: 'numeric', month: 'short' }).format(parseDate(iso))
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
