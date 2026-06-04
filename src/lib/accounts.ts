import { createAdminClient } from './getClient()'

// All account operations run server-side (API routes, server components, layout.tsx).
// Use admin client so service_role bypasses RLS — accounts are never exposed to the browser.
function getClient() { return createAdminClient() }

export type AccountPlano = 'trial' | 'starter' | 'pro'
export type AccountEstado = 'trial' | 'activo' | 'suspenso' | 'cancelado'

export interface Account {
  id: string
  clerk_user_id: string
  email: string
  nome: string | null
  plano: AccountPlano
  estado: AccountEstado
  trial_ends_at: string | null
  propriedades_max: number
  notas_admin: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  current_period_end: string | null
  criado_em: string
  atualizado_em: string
}

export interface AccountComEstatisticas extends Account {
  propriedades_count: number
  reservas_count: number
}

// ─── Sincroniza publicMetadata no Clerk ────────────────────────────────────

export async function syncAccountToClerk(
  clerkUserId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/metadata`, {
      method: 'PATCH',
      headers: {
        Authorization:  `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_metadata: metadata }),
    })
  } catch (err) {
    console.error('[syncAccountToClerk]', err)
  }
}

// ─── Chamada em cada page load do app ──────────────────────────────────────

/**
 * Cria conta na primeira visita.
 * - Se conta nova: sincroniza publicMetadata no Clerk para o middleware poder ler do JWT
 * - Se já existe: não faz nada (idempotente)
 */
export async function ensureAccount(
  clerkUserId: string,
  email: string,
  nome: string | null,
): Promise<void> {
  const { data, error } = await getClient()
    .from('accounts')
    .insert({ clerk_user_id: clerkUserId, email, nome, propriedades_max: 1 })
    .select('id, trial_ends_at')
    .single()

  if (error) {
    // 23505 = unique violation = conta já existe — não é erro
    if (error.code !== '23505') {
      console.error('[ensureAccount]', error.message)
    }
    return
  }

  // Conta nova criada — sync Clerk para o middleware passar a enforçar
  if (data) {
    await syncAccountToClerk(clerkUserId, {
      plano:          'trial',
      estado:         'trial',
      trial_ends_at:  data.trial_ends_at,
    })
  }
}

// ─── Admin ──────────────────────────────────────────────────────────────────

/** Lista todas as contas com contagens de propriedades e reservas. */
export async function listAllAccounts(): Promise<AccountComEstatisticas[]> {
  const [accountsRes, propsRes, bookingsRes] = await Promise.all([
    getClient().from('accounts').select('*').order('criado_em', { ascending: false }),
    getClient().from('properties').select('owner_id'),
    getClient().from('bookings').select('owner_id'),
  ])

  const accounts = (accountsRes.data ?? []) as Account[]

  // contagem de propriedades por owner_id
  const propCount = new Map<string, number>()
  for (const p of propsRes.data ?? []) {
    propCount.set(p.owner_id, (propCount.get(p.owner_id) ?? 0) + 1)
  }

  // contagem de reservas por owner_id
  const bookCount = new Map<string, number>()
  for (const b of bookingsRes.data ?? []) {
    bookCount.set(b.owner_id, (bookCount.get(b.owner_id) ?? 0) + 1)
  }

  return accounts.map(a => ({
    ...a,
    propriedades_count: propCount.get(a.clerk_user_id) ?? 0,
    reservas_count: bookCount.get(a.clerk_user_id) ?? 0,
  }))
}

/** Devolve uma conta pelo id interno. */
export async function getAccountById(id: string): Promise<Account | null> {
  const { data, error } = await getClient()
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as Account
}

/** Devolve uma conta pelo clerk_user_id. */
export async function getAccountByClerkId(clerkUserId: string): Promise<Account | null> {
  const { data, error } = await getClient()
    .from('accounts')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single()
  if (error || !data) return null
  return data as Account
}

/** Actualiza campos da conta (admin ou webhook). */
export async function updateAccount(
  id: string,
  updates: Partial<Pick<
    Account,
    | 'estado' | 'plano' | 'propriedades_max' | 'notas_admin'
    | 'stripe_customer_id' | 'stripe_subscription_id'
    | 'stripe_price_id' | 'current_period_end'
  >>,
): Promise<void> {
  const { error } = await getClient().from('accounts').update(updates).eq('id', id)
  if (error) throw new Error(`[updateAccount] ${error.message}`)
}

/** Actualiza pelo stripe_customer_id (útil nos webhooks). */
export async function updateAccountByCustomerId(
  stripeCustomerId: string,
  updates: Partial<Pick<
    Account,
    | 'estado' | 'plano' | 'propriedades_max'
    | 'stripe_subscription_id' | 'stripe_price_id' | 'current_period_end'
  >>,
): Promise<void> {
  const { error } = await getClient()
    .from('accounts')
    .update(updates)
    .eq('stripe_customer_id', stripeCustomerId)
  if (error) throw new Error(`[updateAccountByCustomerId] ${error.message}`)
}

/** Devolve uma conta pelo stripe_customer_id. */
export async function getAccountByCustomerId(stripeCustomerId: string): Promise<Account | null> {
  const { data, error } = await getClient()
    .from('accounts')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()
  if (error || !data) return null
  return data as Account
}
