/**
 * Client-side data fetchers that go through authenticated API routes.
 * Use instead of db.get* in 'use client' components — these bypass
 * the anon Supabase client and return owner-filtered data via the admin key.
 */

import type { Guest, Booking, Property, WebsiteSettings, Expense, Automation, Post, PlatformRate } from './types'

export async function fetchSettings(): Promise<WebsiteSettings | null> {
  const res = await fetch('/api/website-settings')
  if (!res.ok) return null
  return res.json()
}

export async function fetchGuests(): Promise<Guest[]> {
  const res = await fetch('/api/guests')
  return res.ok ? res.json() : []
}

/**
 * Reservas do anfitrião.
 *
 * `de`/`ate` limitam ao que a página precisa — um ano, um mês. Vale a pena
 * usá-los: sem intervalo vem tudo, e "tudo" ao fim de uns anos são milhares de
 * linhas com o histórico completo de cada uma a atravessar a ligação do
 * telemóvel de quem só quer ver as chegadas de hoje.
 */
export async function fetchBookings(intervalo?: { de?: string; ate?: string }): Promise<Booking[]> {
  const params = new URLSearchParams()
  if (intervalo?.de) params.set('de', intervalo.de)
  if (intervalo?.ate) params.set('ate', intervalo.ate)
  const qs = params.toString()

  const res = await fetch(`/api/bookings${qs ? `?${qs}` : ''}`)
  return res.ok ? res.json() : []
}

export async function fetchExpenses(): Promise<Expense[]> {
  const res = await fetch('/api/expenses')
  return res.ok ? res.json() : []
}

export async function fetchAutomations(): Promise<Automation[]> {
  const res = await fetch('/api/automations')
  return res.ok ? res.json() : []
}

export async function fetchPosts(): Promise<Post[]> {
  const res = await fetch('/api/posts')
  return res.ok ? res.json() : []
}

export async function fetchPlatformRates(): Promise<PlatformRate[]> {
  const res = await fetch('/api/platform-rates')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchProperties(_ownerId?: string): Promise<Property[]> {
  // Properties have an anon read policy (active only), but we want ALL properties
  // including inactive ones for the admin pages — use API route.
  const res = await fetch('/api/properties')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
