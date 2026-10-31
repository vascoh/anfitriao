import { describe, it, expect, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { checkCronAuth } from './cron-auth'

function pedido(auth?: string) {
  return new NextRequest('http://localhost/api/cron/x', auth ? { headers: { authorization: auth } } : undefined)
}

afterEach(() => vi.unstubAllEnvs())

describe('checkCronAuth', () => {
  it('aceita o segredo da Vercel', () => {
    vi.stubEnv('CRON_SECRET', 'vercel')
    expect(checkCronAuth(pedido('Bearer vercel'))).toBeNull()
  })

  it('aceita o segredo do agendador externo (pg_cron)', () => {
    vi.stubEnv('CRON_SECRET', 'vercel')
    vi.stubEnv('CRON_SECRET_EXTERNO', 'supabase')
    expect(checkCronAuth(pedido('Bearer supabase'))).toBeNull()
  })

  it('recusa sem cabeçalho ou com segredo errado', () => {
    vi.stubEnv('CRON_SECRET', 'vercel')
    vi.stubEnv('CRON_SECRET_EXTERNO', 'supabase')
    expect(checkCronAuth(pedido())?.status).toBe(401)
    expect(checkCronAuth(pedido('Bearer outro'))?.status).toBe(401)
    expect(checkCronAuth(pedido('vercel'))?.status).toBe(401)
  })

  it('só com o segredo externo definido, o vazio não passa', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('CRON_SECRET_EXTERNO', 'supabase')
    expect(checkCronAuth(pedido('Bearer '))?.status).toBe(401)
  })

  it('em produção sem nenhum segredo, bloqueia', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('CRON_SECRET_EXTERNO', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(checkCronAuth(pedido())?.status).toBe(503)
  })
})
