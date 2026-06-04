import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, priceToPlano, PLAN_LIMITS } from '@/lib/stripe'
import {
  updateAccount,
  updateAccountByCustomerId,
  getAccountByCustomerId,
  syncAccountToClerk,
} from '@/lib/accounts'

// Raw body necessário para verificar assinatura do Stripe
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Configuração em falta' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Assinatura inválida:', err)
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  try {
    await handleEvent(event)
  } catch (err) {
    console.error(`[webhook] Erro em ${event.type}:`, err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handler principal ────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {

    // Pagamento concluído — activar conta
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const accountId   = session.metadata?.account_id
      const customerId  = session.customer as string
      const subId       = session.subscription as string

      if (!accountId || !subId) break

      const sub    = await stripe.subscriptions.retrieve(subId)
      const item   = sub.items.data[0]
      const priceId = item?.price.id ?? ''
      const plano  = priceToPlano(priceId)
      const limits = PLAN_LIMITS[plano]
      // No Stripe v22, current_period_end está no SubscriptionItem, não na Subscription
      const periodEnd = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      await updateAccount(accountId, {
        estado:                'activo',
        plano,
        stripe_customer_id:    customerId,
        stripe_subscription_id: subId,
        stripe_price_id:       priceId,
        current_period_end:    periodEnd,
        propriedades_max:      limits.propriedades_max,
      })

      await syncClerkMetadata(customerId, plano, 'activo')
      break
    }

    // Subscrição actualizada (upgrade/downgrade)
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const item       = sub.items.data[0]
      const priceId    = item?.price.id ?? ''
      const plano      = priceToPlano(priceId)
      const limits     = PLAN_LIMITS[plano]
      const periodEnd  = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      // Se cancelamento agendado mas ainda activo
      const estado = sub.status === 'active' ? 'activo'
        : sub.status === 'past_due'           ? 'suspenso'
        : 'activo'

      await updateAccountByCustomerId(customerId, {
        estado,
        plano,
        stripe_subscription_id: sub.id,
        stripe_price_id:        priceId,
        current_period_end:     periodEnd,
        propriedades_max:       limits.propriedades_max,
      })

      await syncClerkMetadata(customerId, plano, estado)
      break
    }

    // Subscrição cancelada
    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string

      await updateAccountByCustomerId(customerId, {
        estado:                'cancelado',
        plano:                 'trial',
        stripe_subscription_id: null as unknown as string,
        stripe_price_id:        null as unknown as string,
        current_period_end:     null as unknown as string,
        propriedades_max:       PLAN_LIMITS.trial.propriedades_max,
      })

      await syncClerkMetadata(customerId, 'trial', 'cancelado')
      break
    }

    // Pagamento falhou — suspender
    case 'invoice.payment_failed': {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      await updateAccountByCustomerId(customerId, { estado: 'suspenso' })
      await syncClerkMetadata(customerId, null, 'suspenso')
      break
    }

    // Pagamento bem sucedido — garantir que está activo
    case 'invoice.payment_succeeded': {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      if (invoice.billing_reason === 'subscription_create') break // já tratado em checkout.session.completed

      const account = await getAccountByCustomerId(customerId)
      if (account && account.estado === 'suspenso') {
        await updateAccountByCustomerId(customerId, { estado: 'activo' })
        await syncClerkMetadata(customerId, account.plano, 'activo')
      }
      break
    }

    default:
      // Ignorar eventos não tratados
      break
  }
}

// ─── Sincroniza metadados no Clerk (para o middleware ler do JWT) ─────────────

async function syncClerkMetadata(
  stripeCustomerId: string,
  plano: string | null,
  estado: string,
) {
  const account = await getAccountByCustomerId(stripeCustomerId)
  if (!account) return
  await syncAccountToClerk(account.clerk_user_id, {
    plano:  plano ?? account.plano,
    estado,
  })
}
