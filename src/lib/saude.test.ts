import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'

vi.mock('server-only', () => ({}))
vi.mock('./supabase', () => ({ createAdminClient: vi.fn() }))

const { verificarConfiguracao, piorNivel } = await import('./saude')

const AMBIENTE_VALIDO: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'noreply@anfitrioes.pt',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role',
  STRIPE_SECRET_KEY: 'sk_live_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  STRIPE_STARTER_PRICE_ID: 'price_starter',
  STRIPE_PRO_PRICE_ID: 'price_pro',
  STRIPE_EMPRESA_PRICE_ID: 'price_empresa',
  CRON_SECRET: 'segredo',
  INVOICEXPRESS_PARTNER_API_KEY: 'partner',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_123',
}

describe('verificarConfiguracao', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENCRYPTION_KEY', randomBytes(32).toString('base64'))
  })

  afterEach(() => vi.unstubAllEnvs())

  it('declara saudável uma configuração completa de produção', () => {
    const verificacoes = verificarConfiguracao(AMBIENTE_VALIDO)
    expect(verificacoes.every(v => v.nivel === 'ok')).toBe(true)
  })

  it('não confunde uma chave Clerk ausente com uma instância de produção', () => {
    const ambiente = { ...AMBIENTE_VALIDO, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '' }
    const clerk = verificarConfiguracao(ambiente).find(v => v.chave === 'clerk')
    expect(clerk).toMatchObject({ nivel: 'erro' })
  })

  it('expõe todos os elementos Stripe que podem partir o checkout', () => {
    const ambiente = {
      ...AMBIENTE_VALIDO,
      STRIPE_SECRET_KEY: '',
      STRIPE_PRO_PRICE_ID: '',
      STRIPE_EMPRESA_PRICE_ID: '',
    }
    const stripe = verificarConfiguracao(ambiente).find(v => v.chave === 'stripe')
    expect(stripe).toMatchObject({ nivel: 'aviso' })
    expect(stripe?.detalhe).toContain('chave secreta')
    expect(stripe?.detalhe).toContain('preço Pro')
    expect(stripe?.detalhe).toContain('preço Empresa')
  })

  it('trata um cron desprotegido como erro em produção', () => {
    const cron = verificarConfiguracao({ ...AMBIENTE_VALIDO, CRON_SECRET: '' })
      .find(v => v.chave === 'cron')
    expect(cron).toMatchObject({ nivel: 'erro' })
  })
})

describe('piorNivel', () => {
  it('dá prioridade ao erro', () => {
    expect(piorNivel([
      { chave: 'a', titulo: 'A', nivel: 'ok', detalhe: '' },
      { chave: 'b', titulo: 'B', nivel: 'aviso', detalhe: '' },
      { chave: 'c', titulo: 'C', nivel: 'erro', detalhe: '' },
    ])).toBe('erro')
  })
})
