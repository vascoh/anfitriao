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

// Houve aqui um `createUserClient(clerkToken)` — cliente com o JWT do Clerk, para
// o RLS por `requesting_owner_id()` filtrar a nível de base de dados. Nunca teve
// chamadas: o template JWT do Clerk não chegou a ser configurado, e o isolamento
// real em produção é `service_role` + filtro explícito por `owner_id`.
// Removido a 2026-09-08 com os seus dois envolucros (`lib/supabase-server.ts`).
// A decisão de ligar o template continua em aberto e os passos estão em
// `docs/HANDOFF.md` § «Nota crítica — Clerk JWT template».
