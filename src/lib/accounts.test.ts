import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/** Conta devolvida pelo `select` — o estado antes da alteração. */
let contaNaBase: Record<string, unknown> | null = null
const escritas: Array<Record<string, unknown>> = []

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: contaNaBase, error: null }),
          single: async () => ({ data: contaNaBase, error: null }),
        }),
      }),
      update: (campos: Record<string, unknown>) => ({
        eq: async () => {
          escritas.push(campos)
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock('./audit', () => ({ logAudit: async () => {} }))

const { updateAccount } = await import('./accounts')

/** Chamadas ao Clerk, que a app faz por `fetch` direto à API deles. */
let chamadasClerk: Array<{ url: string; metadata: Record<string, unknown> }> = []

beforeEach(() => {
  escritas.length = 0
  chamadasClerk = []
  contaNaBase = {
    id: 'acc_1',
    clerk_user_id: 'user_123',
    email: 'anfitriao@exemplo.pt',
    plano: 'pro',
    estado: 'activo',
    trial_ends_at: null,
    propriedades_max: 10,
  }
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    chamadasClerk.push({ url, metadata: JSON.parse(init.body).public_metadata })
    return { ok: true }
  })
})

describe('updateAccount', () => {
  it('suspender uma conta sincroniza o Clerk — senão não suspende nada', async () => {
    /* O middleware lê o estado do JWT, não da base. Sem esta sincronização,
     * o painel mostrava a conta suspensa e o utilizador continuava a entrar
     * como se nada fosse até um evento do Stripe passar por ali. */
    await updateAccount('acc_1', { estado: 'suspenso' }, 'admin_1')

    expect(escritas[0]).toEqual({ estado: 'suspenso' })
    expect(chamadasClerk).toHaveLength(1)
    expect(chamadasClerk[0].url).toContain('user_123')
    expect(chamadasClerk[0].metadata).toMatchObject({ estado: 'suspenso', plano: 'pro' })
  })

  it('mudar o plano também sincroniza, mantendo o estado', async () => {
    await updateAccount('acc_1', { plano: 'empresa' }, 'admin_1')
    expect(chamadasClerk[0].metadata).toMatchObject({ estado: 'activo', plano: 'empresa' })
  })

  it('leva o fim do trial quando existe — o middleware conta os dias por ele', async () => {
    contaNaBase = { ...contaNaBase, estado: 'trial', trial_ends_at: '2026-09-01T00:00:00Z' }
    await updateAccount('acc_1', { estado: 'trial' }, 'admin_1')
    expect(chamadasClerk[0].metadata).toMatchObject({ trial_ends_at: '2026-09-01T00:00:00Z' })
  })

  it('mudanças que não mexem no acesso não chamam o Clerk', async () => {
    // Uma nota interna não muda o que o utilizador pode fazer.
    await updateAccount('acc_1', { notas_admin: 'ligou a pedir fatura' }, 'admin_1')
    expect(escritas[0]).toEqual({ notas_admin: 'ligou a pedir fatura' })
    expect(chamadasClerk).toHaveLength(0)
  })

  it('uma conta que não existe não rebenta a sincronização', async () => {
    contaNaBase = null
    await expect(updateAccount('acc_perdida', { estado: 'suspenso' }, 'admin_1')).resolves.toBeUndefined()
    expect(chamadasClerk).toHaveLength(0)
  })
})
