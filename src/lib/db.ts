import { supabase } from './supabase'
import type { Property, Guest, Booking, WebsiteSettings } from './types'

// DB row types (snake_case as stored in Supabase)
type PropertyRow = Omit<Property, 'casasBanho'> & { casas_banho: number }

function rowToProperty(row: PropertyRow): Property {
  const { casas_banho, ...rest } = row
  return { ...rest, casasBanho: casas_banho }
}

function propertyToRow(p: Property): PropertyRow {
  const { casasBanho, ...rest } = p
  return { ...rest, casas_banho: casasBanho }
}

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: true,
  nome: 'Reservas Diretas',
  descricao: 'Reserve diretamente connosco sem taxas de intermediários.',
  email: '',
  telefone: '',
  min_noites: 1,
  antecedencia_dias: 1,
}

export const db = {
  // Properties
  getProperties: async (): Promise<Property[]> => {
    const { data, error } = await supabase.from('properties').select('*').order('criado_em', { ascending: false })
    if (error) { console.error(error); return [] }
    return (data as PropertyRow[]).map(rowToProperty)
  },

  saveProperty: async (p: Property): Promise<void> => {
    const row = propertyToRow(p)
    const { error } = await supabase.from('properties').upsert(row)
    if (error) throw error
  },

  deleteProperty: async (id: string): Promise<void> => {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) throw error
  },

  // Guests
  getGuests: async (): Promise<Guest[]> => {
    const { data, error } = await supabase.from('guests').select('*').order('criado_em', { ascending: false })
    if (error) { console.error(error); return [] }
    return data as Guest[]
  },

  saveGuest: async (g: Guest): Promise<void> => {
    const { error } = await supabase.from('guests').upsert(g)
    if (error) throw error
  },

  deleteGuest: async (id: string): Promise<void> => {
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (error) throw error
  },

  // Bookings
  getBookings: async (): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*').order('criado_em', { ascending: false })
    if (error) { console.error(error); return [] }
    return data as Booking[]
  },

  saveBooking: async (b: Booking): Promise<void> => {
    const { error } = await supabase.from('bookings').upsert(b)
    if (error) throw error
  },

  deleteBooking: async (id: string): Promise<void> => {
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) throw error
  },

  // Website settings (single row, id=1)
  getWebsiteSettings: async (): Promise<WebsiteSettings> => {
    const { data, error } = await supabase.from('website_settings').select('*').eq('id', 1).single()
    if (error || !data) return DEFAULT_WEBSITE
    const { id: _, ...settings } = data as WebsiteSettings & { id: number }
    return settings
  },

  saveWebsiteSettings: async (s: WebsiteSettings): Promise<void> => {
    const { error } = await supabase.from('website_settings').upsert({ id: 1, ...s })
    if (error) throw error
  },
}
