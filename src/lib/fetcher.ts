/**
 * Client-side data fetchers that go through authenticated API routes.
 * Use instead of db.get* in 'use client' components — these bypass
 * the anon Supabase client and return owner-filtered data via the admin key.
 */

import type { Guest, Booking, Property } from './types'

export async function fetchGuests(): Promise<Guest[]> {
  const res = await fetch('/api/guests')
  return res.ok ? res.json() : []
}

export async function fetchBookings(): Promise<Booking[]> {
  const res = await fetch('/api/bookings')
  return res.ok ? res.json() : []
}

export async function fetchProperties(ownerId?: string): Promise<Property[]> {
  // Properties have an anon read policy (active only), but we want ALL properties
  // including inactive ones for the admin pages — use API route.
  const res = await fetch('/api/properties')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
