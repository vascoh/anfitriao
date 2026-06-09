/**
 * Server-only Supabase helper that uses the Clerk JWT for authenticated queries.
 * When the Clerk "supabase" JWT template is configured, RLS policies (owner isolation)
 * apply automatically without needing manual .eq('owner_id', userId) filters.
 *
 * Setup (one-time manual steps):
 * 1. Clerk Dashboard → Configure → JWT Templates → New template → "Supabase"
 *    - Use the default Supabase template (adds sub, aud, role claims)
 * 2. Supabase Dashboard → Authentication → JWT → copy "JWT Secret"
 *    - In Clerk JWT template → Advanced → set the signing key to that secret
 *    OR use JWKS URL (Clerk Dashboard → API Keys → Advanced → JWKS URL) in Supabase
 *
 * Until configured, this returns null and callers fall back to admin client + manual filters.
 */

import { auth } from '@clerk/nextjs/server'
import { createUserClient, createAdminClient } from './supabase'

/**
 * Returns a Supabase client authenticated with the current Clerk user's JWT.
 * Falls back to null if the JWT template is not configured (no throw).
 */
export async function getSupabaseUserClient() {
  try {
    const { getToken } = await auth()
    const token = await getToken({ template: 'supabase' })
    if (!token) return null
    return createUserClient(token)
  } catch {
    return null
  }
}

/**
 * Returns a Supabase client for the current user:
 * - Uses Clerk JWT + RLS when the "supabase" JWT template is configured
 * - Falls back to the admin client (requires manual owner_id filtering in callers)
 *
 * Returns { client, useRLS } so callers know whether to add manual owner filters.
 */
export async function getSupabaseForRequest(): Promise<{
  client: ReturnType<typeof createAdminClient>
  useRLS: boolean
}> {
  const userClient = await getSupabaseUserClient()
  if (userClient) return { client: userClient as ReturnType<typeof createAdminClient>, useRLS: true }
  return { client: createAdminClient(), useRLS: false }
}
