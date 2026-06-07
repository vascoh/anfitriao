/**
 * Server-only data helpers using the admin client (bypasses RLS).
 * Import ONLY from API routes, server components, and server-only lib files.
 * NEVER import in 'use client' components.
 */

import { createAdminClient } from './supabase'
import type { Booking, Guest, Property, WebsiteSettings } from './types'

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: false,
  nome: 'Reservas Diretas',
  descricao: '',
  email: '',
  telefone: '',
  min_noites: 1,
  antecedencia_dias: 0,
}

function getSupabase() {
  return createAdminClient()
}

export async function adminGetBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await getSupabase().from('bookings').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as Booking
}

export async function adminGetGuestById(id: string): Promise<Guest | null> {
  const { data, error } = await getSupabase().from('guests').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as Guest
}

export async function adminGetPropertyById(id: string): Promise<Property | null> {
  const { data, error } = await getSupabase().from('properties').select('*').eq('id', id).single()
  if (error || !data) return null
  const { casas_banho, ...rest } = data as Record<string, unknown>
  return { ...rest, casasBanho: casas_banho } as unknown as Property
}

export async function adminGetWebsiteSettings(ownerId?: string | null): Promise<WebsiteSettings> {
  const supabase = getSupabase()
  let q = supabase.from('website_settings').select('*')
  if (ownerId) {
    q = q.eq('owner_id', ownerId)
  } else {
    q = q.eq('id', 1)
  }
  const { data } = await q.maybeSingle()
  if (!data) return DEFAULT_WEBSITE
  const { id: _, ...settings } = data as WebsiteSettings & { id: number }
  return settings
}

export async function adminGetBookings(ownerId?: string): Promise<Booking[]> {
  let q = getSupabase().from('bookings').select('*').order('criado_em', { ascending: false })
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) { console.error('[adminGetBookings]', error.message); return [] }
  return data as Booking[]
}

export async function adminGetProperties(ownerId?: string): Promise<Property[]> {
  let q = getSupabase().from('properties').select('*')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) { console.error('[adminGetProperties]', error.message); return [] }
  return (data as Record<string, unknown>[]).map(({ casas_banho, ...rest }) => ({ ...rest, casasBanho: casas_banho }) as unknown as Property)
}

export async function adminGetPriceRules(ownerId?: string) {
  let q = getSupabase().from('price_rules').select('*')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) { console.error('[adminGetPriceRules]', error.message); return [] }
  return data ?? []
}

export async function adminGetTarifas(ownerId?: string) {
  let q = getSupabase().from('tarifas').select('*')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) { console.error('[adminGetTarifas]', error.message); return [] }
  return data ?? []
}

export async function adminGetPlatformRates(ownerId?: string) {
  let q = getSupabase().from('platform_rates').select('*')
  if (ownerId) q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) { console.error('[adminGetPlatformRates]', error.message); return [] }
  return data ?? []
}

export async function adminGetWebsiteSettingsBySlug(slug: string): Promise<WebsiteSettings | null> {
  const { data, error } = await getSupabase()
    .from('website_settings')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data as WebsiteSettings
}
