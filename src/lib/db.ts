import { supabase } from './supabase'
import type { Property, Guest, Booking, WebsiteSettings, PriceRule, Tarifa, PlatformRate } from './types'

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
  antecedencia_dias: 0,
}

export const db = {
  // ─── Properties ────────────────────────────────────────────────────────────

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

  getPropertyById: async (id: string): Promise<Property | null> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return rowToProperty(data as PropertyRow)
  },

  saveProperty: async (p: Property): Promise<void> => {
    const row = propertyToRow(p)
    const { error } = await supabase.from('properties').upsert(row)
    if (error) throw new Error(`[db.saveProperty] ${error.message}`)
  },

  deleteProperty: async (id: string): Promise<void> => {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) throw new Error(`[db.deleteProperty] ${error.message}`)
  },

  // ─── Guests ────────────────────────────────────────────────────────────────

  getGuests: async (ownerId?: string): Promise<Guest[]> => {
    let q = supabase.from('guests').select('*').order('criado_em', { ascending: false })
    if (ownerId) q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getGuests]', error.message)
      return []
    }
    return data as Guest[]
  },

  getGuestById: async (id: string): Promise<Guest | null> => {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return data as Guest
  },

  saveGuest: async (g: Guest): Promise<void> => {
    const { error } = await supabase.from('guests').upsert(g)
    if (error) throw new Error(`[db.saveGuest] ${error.message}`)
  },

  deleteGuest: async (id: string): Promise<void> => {
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (error) throw new Error(`[db.deleteGuest] ${error.message}`)
  },

  // ─── Bookings ──────────────────────────────────────────────────────────────

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

  getBookingById: async (id: string): Promise<Booking | null> => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return data as Booking
  },

  getBookingsByProperty: async (propertyId: string): Promise<Booking[]> => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('propriedade_id', propertyId)
      .order('check_in', { ascending: true })
    if (error) {
      console.error('[db.getBookingsByProperty]', error.message)
      return []
    }
    return data as Booking[]
  },

  // Future bookings only — for availability checks (much lighter than getBookings)
  getActiveBookings: async (ownerId?: string): Promise<Booking[]> => {
    const today = new Date().toISOString().slice(0, 10)
    let q = supabase
      .from('bookings')
      .select('*')
      .gte('check_out', today)
      .not('estado', 'in', '("cancelada","no_show")')
      .order('check_in', { ascending: true })
    if (ownerId) q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getActiveBookings]', error.message)
      return []
    }
    return data as Booking[]
  },

  saveBooking: async (b: Booking): Promise<void> => {
    const { error } = await supabase.from('bookings').upsert(b)
    if (error) throw new Error(`[db.saveBooking] ${error.message}`)
  },

  deleteBooking: async (id: string): Promise<void> => {
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) throw new Error(`[db.deleteBooking] ${error.message}`)
  },

  // ─── Website settings ──────────────────────────────────────────────────────

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

  saveWebsiteSettings: async (s: WebsiteSettings, ownerId?: string): Promise<void> => {
    // If we have an owner_id and the settings already have one, update by owner_id
    if (ownerId || s.owner_id) {
      const targetOwner = ownerId ?? s.owner_id
      // Try to update existing row first
      const { data: existing } = await supabase
        .from('website_settings')
        .select('id')
        .eq('owner_id', targetOwner)
        .maybeSingle()
      if (existing) {
        const { error } = await supabase
          .from('website_settings')
          .update({ ...s, owner_id: targetOwner })
          .eq('owner_id', targetOwner)
        if (error) throw new Error(`[db.saveWebsiteSettings] ${error.message}`)
        return
      }
    }
    // Legacy: upsert by id=1 (single-tenant fallback)
    const { error } = await supabase.from('website_settings').upsert({ id: 1, ...s })
    if (error) throw new Error(`[db.saveWebsiteSettings] ${error.message}`)
  },

  /** Public: look up a host's website settings by their URL slug */
  getWebsiteSettingsBySlug: async (slug: string): Promise<WebsiteSettings | null> => {
    const { data, error } = await supabase
      .from('website_settings')
      .select('*')
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    const { id: _, ...settings } = data as WebsiteSettings & { id: number }
    return settings
  },

  /** Public: fetch active top-level properties for a given owner (for the booking site) */
  getPropertiesByOwner: async (ownerId: string): Promise<Property[]> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('ativo', true)
      .is('parent_id', null)
      .order('criado_em', { ascending: true })
    if (error) {
      console.error('[db.getPropertiesByOwner]', error.message)
      return []
    }
    return (data as (Property & { casas_banho: number })[]).map(row => {
      const { casas_banho, ...rest } = row as never as { casas_banho: number } & Omit<Property, 'casasBanho'>
      return { ...rest, casasBanho: casas_banho }
    })
  },

  // ─── Price rules ───────────────────────────────────────────────────────────

  getPriceRules: async (propertyId?: string): Promise<PriceRule[]> => {
    let q = supabase
      .from('price_rules')
      .select('*')
      .order('prioridade', { ascending: false })
      .order('criado_em', { ascending: false })
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getPriceRules]', error.message)
      return []
    }
    return data as PriceRule[]
  },

  savePriceRule: async (r: PriceRule): Promise<void> => {
    const { error } = await supabase.from('price_rules').upsert(r)
    if (error) throw new Error(`[db.savePriceRule] ${error.message}`)
  },

  deletePriceRule: async (id: string): Promise<void> => {
    const { error } = await supabase.from('price_rules').delete().eq('id', id)
    if (error) throw new Error(`[db.deletePriceRule] ${error.message}`)
  },

  // ─── Tarifas ───────────────────────────────────────────────────────────────

  getTarifas: async (propertyId?: string): Promise<Tarifa[]> => {
    let q = supabase
      .from('tarifas')
      .select('*')
      .order('criado_em', { ascending: false })
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getTarifas]', error.message)
      return []
    }
    return data as Tarifa[]
  },

  saveTarifa: async (t: Tarifa): Promise<void> => {
    const { error } = await supabase.from('tarifas').upsert(t)
    if (error) throw new Error(`[db.saveTarifa] ${error.message}`)
  },

  deleteTarifa: async (id: string): Promise<void> => {
    const { error } = await supabase.from('tarifas').delete().eq('id', id)
    if (error) throw new Error(`[db.deleteTarifa] ${error.message}`)
  },

  // ─── Platform rates ────────────────────────────────────────────────────────

  getPlatformRates: async (propertyId?: string): Promise<PlatformRate[]> => {
    let q = supabase.from('platform_rates').select('*').order('plataforma')
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data, error } = await q
    if (error) {
      console.error('[db.getPlatformRates]', error.message)
      return []
    }
    return data as PlatformRate[]
  },

  savePlatformRate: async (r: PlatformRate): Promise<void> => {
    const { error } = await supabase
      .from('platform_rates')
      .upsert(r, { onConflict: 'property_id,plataforma' })
    if (error) throw new Error(`[db.savePlatformRate] ${error.message}`)
  },

  deletePlatformRate: async (id: string): Promise<void> => {
    const { error } = await supabase.from('platform_rates').delete().eq('id', id)
    if (error) throw new Error(`[db.deletePlatformRate] ${error.message}`)
  },

  // ─── Price change log ──────────────────────────────────────────────────────

  logPriceChange: async (
    propertyId: string,
    tipo: string,
    descricao: string,
    dadosAnteriores?: object,
    dadosNovos?: object,
  ): Promise<void> => {
    const { error } = await supabase.from('price_change_log').insert({
      property_id: propertyId,
      tipo,
      descricao,
      dados_anteriores: dadosAnteriores ?? null,
      dados_novos: dadosNovos ?? null,
    })
    if (error) console.error('[db.logPriceChange]', error.message)
  },
}
