/**
 * Client-side data fetchers that go through authenticated API routes.
 * Use instead of db.get* in 'use client' components — these bypass
 * the anon Supabase client and return owner-filtered data via the admin key.
 */

import type { Guest, Booking, Property, WebsiteSettings, Expense, Automation, Post, PlatformRate } from './types'

export interface FetchOptions {
  /**
   * Não transformar uma resposta HTTP com erro numa coleção vazia.
   *
   * Usa-se nas páginas onde vazio e falha têm consequências diferentes
   * (calendário, reservas, relatórios e conformidade). Mantém-se opcional
   * para não mudar de uma vez todos os ecrãs antigos que ainda não têm um
   * estado de erro próprio.
   */
  exigirSucesso?: boolean
}

async function lerJson<T>(res: Response, fallback: T, opcoes?: FetchOptions): Promise<T> {
  if (!res.ok) {
    if (opcoes?.exigirSucesso) {
      throw new Error(`Pedido falhou (${res.status})`)
    }
    return fallback
  }
  return res.json() as Promise<T>
}

export async function fetchSettings(opcoes?: FetchOptions): Promise<WebsiteSettings | null> {
  const res = await fetch('/api/website-settings')
  return lerJson(res, null, opcoes)
}

export async function fetchGuests(opcoes?: FetchOptions): Promise<Guest[]> {
  const res = await fetch('/api/guests')
  return lerJson(res, [], opcoes)
}

/**
 * Reservas do anfitrião.
 *
 * `de`/`ate` limitam ao que a página precisa — um ano, um mês. Vale a pena
 * usá-los: sem intervalo vem tudo, e "tudo" ao fim de uns anos são milhares de
 * linhas com o histórico completo de cada uma a atravessar a ligação do
 * telemóvel de quem só quer ver as chegadas de hoje.
 */
export async function fetchBookings(
  intervalo?: { de?: string; ate?: string },
  opcoes?: FetchOptions,
): Promise<Booking[]> {
  const params = new URLSearchParams()
  if (intervalo?.de) params.set('de', intervalo.de)
  if (intervalo?.ate) params.set('ate', intervalo.ate)
  const qs = params.toString()

  const res = await fetch(`/api/bookings${qs ? `?${qs}` : ''}`)
  return lerJson(res, [], opcoes)
}

export async function fetchExpenses(opcoes?: FetchOptions): Promise<Expense[]> {
  const res = await fetch('/api/expenses')
  return lerJson(res, [], opcoes)
}

export async function fetchAutomations(opcoes?: FetchOptions): Promise<Automation[]> {
  const res = await fetch('/api/automations')
  return lerJson(res, [], opcoes)
}

export async function fetchPosts(opcoes?: FetchOptions): Promise<Post[]> {
  const res = await fetch('/api/posts')
  return lerJson(res, [], opcoes)
}

export async function fetchPlatformRates(opcoes?: FetchOptions): Promise<PlatformRate[]> {
  const res = await fetch('/api/platform-rates')
  const data = await lerJson<unknown>(res, [], opcoes)
  return Array.isArray(data) ? data : []
}

export async function fetchProperties(opcoes?: FetchOptions): Promise<Property[]> {
  // Properties have an anon read policy (active only), but we want ALL properties
  // including inactive ones for the admin pages — use API route.
  const res = await fetch('/api/properties')
  const data = await lerJson<unknown>(res, [], opcoes)
  return Array.isArray(data) ? data : []
}
