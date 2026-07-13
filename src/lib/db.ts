import { supabase } from './supabase'
import type { Property, Booking, WebsiteSettings } from './types'

// Cliente anon usado APENAS pelas páginas públicas /book (RLS aplica-se).
// Todo o acesso autenticado passa por API routes (fetcher.ts → service_role
// com filtro por owner) — não adicionar aqui writes nem getters por id.

// DB row types (snake_case as stored in Supabase)
type PropertyRow = Omit<Property, 'casasBanho'> & { casas_banho: number }

function rowToProperty(row: PropertyRow): Property {
  const { casas_banho, ...rest } = row
  return { ...rest, casasBanho: casas_banho }
}

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: true,
  nome: 'Reservas Diretas',
  descricao: 'Reserve diretamente connosco sem taxas de intermediários.',
  email: '',
  telefone: '',
  min_noites: 1,
  antecedencia_dias: 0,
}

export const db = {
  getProperties: async (ownerId?: string): Promise<Property[]> => {
    let q = supabase.from('properties').select('*').order('criado_em', { ascending: false })
    if (ownerId) q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getProperties]', error.message)
      return []
    }
    return (data as PropertyRow[]).map(rowToProperty)
  },

  getBookings: async (ownerId?: string): Promise<Booking[]> => {
    let q = supabase.from('bookings').select('*').order('criado_em', { ascending: false })
    if (ownerId) q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getBookings]', error.message)
      return []
    }
    return data as Booking[]
  },

  getWebsiteSettings: async (ownerId?: string): Promise<WebsiteSettings> => {
    let q = supabase.from('website_settings').select('*')
    // Multi-tenant: query by owner_id when available; fall back to legacy id=1 row
    if (ownerId) {
      q = q.eq('owner_id', ownerId)
    } else {
      q = q.eq('id', 1)
    }
    const { data, error } = await q.maybeSingle()
    if (error || !data) return DEFAULT_WEBSITE
    const { id: _, ...settings } = data as WebsiteSettings & { id: number }
    return settings
  },
}
