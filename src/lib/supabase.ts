import { createClient } from '@supabase/supabase-js'

// Browser/anon client — subject to RLS policies.
// Use for client-side reads that go through Clerk-authenticated paths.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-only admin client — bypasses RLS via service_role key.
// NEVER expose to the browser. Import only from server components, API routes, and lib files
// that are called exclusively server-side.
// Falls back to anon key if service_role key is not configured (with a warning).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. Set it for proper admin access.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Creates a Supabase client authenticated with a Clerk JWT.
 * The JWT must come from `getToken({ template: 'supabase' })` in Clerk.
 * Enables RLS policies that use requesting_owner_id() to filter by owner.
 *
 * Requires: Clerk Dashboard → JWT Templates → "supabase" template configured,
 * and Supabase Dashboard → Authentication → JWT Secret set to match Clerk's key.
 */
export function createUserClient(clerkToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${clerkToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
