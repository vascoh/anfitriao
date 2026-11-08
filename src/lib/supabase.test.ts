import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const createClient = vi.fn(() => ({ from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

describe('createAdminClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.unstubAllGlobals()
    createClient.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('usa a service role sem emitir avisos', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { createAdminClient } = await import('./supabase')

    createAdminClient()

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role',
      expect.any(Object),
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('avisa uma só vez quando tem de usar a chave anon', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { createAdminClient } = await import('./supabase')

    createAdminClient()
    createAdminClient()

    expect(createClient).toHaveBeenCalledTimes(2)
    expect(createClient).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'anon',
      expect.any(Object),
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
