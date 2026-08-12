import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('stripe', () => ({ default: class { constructor() {} } }))

const { priceToPlano, estadoDaSubscricao } = await import('./stripe')

describe('priceToPlano', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_STARTER_PRICE_ID', 'price_starter')
    vi.stubEnv('STRIPE_PRO_PRICE_ID', 'price_pro')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('reconhece os planos configurados', () => {
    expect(priceToPlano('price_starter')).toBe('starter')
    expect(priceToPlano('price_pro')).toBe('pro')
  })

  it('um preço que não conhecemos não vira Starter', () => {
    /* Devolvia 'starter' por omissão. Com o STRIPE_EMPRESA_PRICE_ID por
     * definir — o caso em produção — um cliente do plano Empresa pagava 99 €
     * e ficava com o limite de 3 unidades, sem ninguém dar por isso. */
    expect(priceToPlano('price_empresa')).toBeNull()
    expect(priceToPlano('price_de_outra_pessoa')).toBeNull()
  })

  it('um preço vazio não coincide com uma variável por definir', () => {
    // '' === undefined é falso, mas o valor podia ser '' nos dois lados.
    vi.stubEnv('STRIPE_EMPRESA_PRICE_ID', '')
    expect(priceToPlano('')).toBeNull()
  })

  it('reconhece o Empresa quando o preço existir', () => {
    vi.stubEnv('STRIPE_EMPRESA_PRICE_ID', 'price_empresa')
    expect(priceToPlano('price_empresa')).toBe('empresa')
  })
})

describe('estadoDaSubscricao', () => {
  it('activa e em período experimental dão conta activa', () => {
    expect(estadoDaSubscricao('active')).toBe('activo')
    expect(estadoDaSubscricao('trialing')).toBe('activo')
  })

  it('cancelada não deixa a conta activa', () => {
    // O mapa anterior mandava tudo o que não fosse past_due para 'activo'.
    expect(estadoDaSubscricao('canceled')).toBe('cancelado')
    expect(estadoDaSubscricao('incomplete_expired')).toBe('cancelado')
  })

  it('pagamento em falta suspende', () => {
    expect(estadoDaSubscricao('past_due')).toBe('suspenso')
    expect(estadoDaSubscricao('unpaid')).toBe('suspenso')
  })

  it('um checkout que nunca se completou não dá conta activa', () => {
    expect(estadoDaSubscricao('incomplete')).toBe('suspenso')
  })

  it('um estado novo do Stripe suspende em vez de abrir as portas', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(estadoDaSubscricao('algo_que_o_stripe_invente')).toBe('suspenso')
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
  })
})
