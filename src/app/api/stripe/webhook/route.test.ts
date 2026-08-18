import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

/**
 * Webhook do Stripe — quem decide o plano e o acesso de cada conta.
 *
 * Dois bugs viveram aqui, e nenhum dava erro: um plano que a app não
 * reconhecia virava Starter (o cliente pagava 99 € e ficava com o limite de
 * 3 unidades), e tudo o que não fosse `past_due` virava "activo" (uma
 * subscrição cancelada mantinha acesso completo).
 */

/* `vi.hoisted` porque as fábricas de `vi.mock` sobem para o topo do ficheiro:
 * uma variável declarada em baixo ainda não existe quando a fábrica corre. */
const estado = vi.hoisted(() => {
  /* O módulo real instancia `new Stripe(STRIPE_SECRET_KEY!)` ao ser
   * importado. Queremos o resto do ficheiro verdadeiro — é lá que vivem o
   * `priceToPlano` e o `estadoDaSubscricao`, que são o que se quer testar —
   * por isso dá-se-lhe uma chave de fachada em vez de o substituir todo. */
  process.env.STRIPE_SECRET_KEY ||= 'sk_test_fachada'
  return {
    eventoValido: true,
    evento: {} as Record<string, unknown>,
    precoDaSubscricao: 'price_starter',
  }
})

vi.mock('@/lib/stripe', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/stripe')>()
  return {
    ...real,
    stripe: {
      webhooks: {
        constructEvent: () => {
          if (!estado.eventoValido) throw new Error('assinatura inválida')
          return estado.evento
        },
      },
      subscriptions: {
        retrieve: async () => ({
          id: 'sub_1',
          status: 'active',
          items: { data: [{ price: { id: estado.precoDaSubscricao }, current_period_end: 1800000000 }] },
        }),
      },
    },
  }
})

const actualizacoes: Array<Record<string, unknown>> = []
const clerk: Array<Record<string, unknown>> = []

vi.mock('@/lib/accounts', () => ({
  updateAccount: async (id: string, updates: Record<string, unknown>) => {
    actualizacoes.push({ id, ...updates })
  },
  updateAccountByCustomerId: async (cus: string, updates: Record<string, unknown>) => {
    actualizacoes.push({ customer: cus, ...updates })
  },
  getAccountByCustomerId: async () => ({ id: 'acc_1', clerk_user_id: 'user_1', plano: 'pro', estado: 'activo' }),
  getAccountByConnectAccountId: async () => ({ id: 'acc_1' }),
  syncAccountToClerk: async (u: string, meta: Record<string, unknown>) => { clerk.push({ u, ...meta }) },
}))

vi.mock('@/lib/checkout-fulfillment', () => ({
  fulfillCheckoutSession: async () => ({ ok: true, bookingId: 'b1', alreadyFulfilled: false }),
}))

const auditoria: Array<Record<string, unknown>> = []
vi.mock('@/lib/audit', () => ({ logAudit: async (p: Record<string, unknown>) => { auditoria.push(p) } }))

const { POST } = await import('./route')

function pedido() {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 'assinatura' },
  })
}

beforeEach(() => {
  estado.eventoValido = true
  estado.precoDaSubscricao = 'price_starter'
  actualizacoes.length = 0
  clerk.length = 0
  auditoria.length = 0
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_teste')
  vi.stubEnv('STRIPE_STARTER_PRICE_ID', 'price_starter')
  vi.stubEnv('STRIPE_PRO_PRICE_ID', 'price_pro')
})

describe('POST /api/stripe/webhook', () => {
  it('recusa uma assinatura inválida', async () => {
    estado.eventoValido = false
    const res = await POST(pedido())
    expect(res.status).toBe(400)
    expect(actualizacoes).toHaveLength(0)
  })

  it('activa a conta quando a subscrição é criada', async () => {
    estado.evento = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { account_id: 'acc_1' }, customer: 'cus_1', subscription: 'sub_1' } },
    }
    const res = await POST(pedido())
    expect(res.status).toBe(200)
    expect(actualizacoes[0]).toMatchObject({ estado: 'activo', plano: 'starter' })
  })

  it('um preço desconhecido não vira Starter', async () => {
    /* Basta o STRIPE_EMPRESA_PRICE_ID não estar definido — o caso em produção
     * — para um cliente do Empresa pagar 99 € e ficar com o limite de 3. */
    estado.precoDaSubscricao = 'price_empresa_por_configurar'
    estado.evento = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { account_id: 'acc_1' }, customer: 'cus_1', subscription: 'sub_1' } },
    }
    await POST(pedido())

    // A conta fica activa — o pagamento é real — mas o plano não se inventa.
    expect(actualizacoes[0].estado).toBe('activo')
    expect(actualizacoes[0].plano).toBeUndefined()
    expect(actualizacoes[0].propriedades_max).toBeUndefined()
    expect(auditoria[0].acao).toBe('plano_por_identificar')
  })

  it('uma subscrição cancelada não deixa a conta activa', async () => {
    // O mapa mandava tudo o que não fosse past_due para 'activo'.
    estado.evento = {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', status: 'canceled', customer: 'cus_1', items: { data: [{ price: { id: 'price_pro' } }] } } },
    }
    await POST(pedido())
    expect(actualizacoes[0].estado).toBe('cancelado')
  })

  it('um checkout abandonado a meio não dá conta activa', async () => {
    estado.evento = {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', status: 'incomplete', customer: 'cus_1', items: { data: [{ price: { id: 'price_pro' } }] } } },
    }
    await POST(pedido())
    expect(actualizacoes[0].estado).toBe('suspenso')
  })

  it('uma subscrição activa mantém a conta activa e o plano certo', async () => {
    estado.evento = {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ price: { id: 'price_pro' } }] } } },
    }
    await POST(pedido())
    expect(actualizacoes[0]).toMatchObject({ estado: 'activo', plano: 'pro' })
  })

  it('cancelamento devolve a conta ao trial', async () => {
    estado.evento = {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    }
    await POST(pedido())
    expect(actualizacoes[0]).toMatchObject({ estado: 'cancelado', plano: 'trial' })
  })

  it('o pagamento de uma reserva de hóspede vai para o preenchimento', async () => {
    estado.evento = {
      type: 'checkout.session.completed',
      account: 'acct_connect',
      data: { object: { id: 'cs_1', mode: 'payment' } },
    }
    const res = await POST(pedido())
    expect(res.status).toBe(200)
    // Não mexe em contas: é dinheiro do anfitrião, não subscrição nossa.
    expect(actualizacoes).toHaveLength(0)
  })

  it('sincroniza o Clerk, que é de onde o middleware lê o estado', async () => {
    estado.evento = {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ price: { id: 'price_pro' } }] } } },
    }
    await POST(pedido())
    expect(clerk[0]).toMatchObject({ estado: 'activo', plano: 'pro' })
  })

  it('um evento que não tratamos responde 200 sem fazer nada', async () => {
    // Devolver erro faria o Stripe repetir para sempre.
    estado.evento = { type: 'invoice.upcoming', data: { object: {} } }
    const res = await POST(pedido())
    expect(res.status).toBe(200)
    expect(actualizacoes).toHaveLength(0)
  })
})
