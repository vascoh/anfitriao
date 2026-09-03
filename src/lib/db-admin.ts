/**
 * Server-only data helpers using the admin client (bypasses RLS).
 * Import ONLY from API routes, server components, and server-only lib files.
 * NEVER import in 'use client' components.
 */

import { createAdminClient } from './supabase'
import { carregarTudo } from './supabase-tudo'
import { revelarCampos } from './campos-sensiveis'
import type { Booking, Guest, Property, WebsiteSettings, Post } from './types'

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
  // Acessor partilhado: quem o usa recebe a ficha legível, não o criptograma.
  return revelarCampos(data as Record<string, unknown>) as unknown as Guest
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

/**
 * Reservas de um anfitrião, para o site público calcular disponibilidade.
 *
 * As duas coisas que esta função fazia mal levavam ao mesmo sítio — **mostrar
 * como livre uma noite que está ocupada**:
 *
 * 1. **Sem paginação.** Ordenada por `criado_em` decrescente, devolvia as mil
 *    reservas criadas mais recentemente. As mais antigas caíam — e uma reserva
 *    antiga pode ser uma estadia **futura**. Num sítio com movimento, o
 *    calendário público começava a mostrar datas vendidas como disponíveis.
 * 2. **Erro devolvia lista vazia.** Nenhuma reserva quer dizer tudo livre: um
 *    tremor da base pintava o calendário inteiro de disponível.
 *
 * Por isso o erro sobe agora em vez de ser engolido. Um site que diz «não foi
 * possível confirmar a disponibilidade» perde um pedido; um site que mostra
 * livre o que está vendido põe duas pessoas à porta.
 */
export async function adminGetBookings(
  ownerId?: string,
): Promise<{ linhas: Booking[]; erro?: string }> {
  return carregarTudo<Booking>(() => {
    let q = getSupabase()
      .from('bookings')
      .select('*')
      .order('criado_em', { ascending: false })
      // Desempate estável: ver a nota sobre ordenação em lib/supabase-tudo.ts.
      .order('id', { ascending: true })
    if (ownerId) q = q.eq('owner_id', ownerId)
    return q
  })
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

/** Slugs de todos os sites públicos ativos — usado para listar os sitemaps por tenant no robots.txt raiz. */
export async function adminGetEnabledSiteSlugs(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('website_settings')
    .select('slug')
    .eq('enabled', true)
    .not('slug', 'is', null)
  if (error) { console.error('[adminGetEnabledSiteSlugs]', error.message); return [] }
  return (data as { slug: string }[]).map(d => d.slug)
}

export async function adminGetPublishedPosts(ownerId: string): Promise<Post[]> {
  const { data, error } = await getSupabase()
    .from('posts')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('publicado', true)
    .order('criado_em', { ascending: false })
  if (error) { console.error('[adminGetPublishedPosts]', error.message); return [] }
  return data as Post[]
}

export async function adminGetPublishedPostBySlug(ownerId: string, slug: string): Promise<Post | null> {
  const { data, error } = await getSupabase()
    .from('posts')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .eq('publicado', true)
    .maybeSingle()
  if (error || !data) return null
  return data as Post
}
