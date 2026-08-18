import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, priceToPlano, estadoDaSubscricao, PLAN_LIMITS } from '@/lib/stripe'
import {
  updateAccount,
  updateAccountByCustomerId,
  getAccountByCustomerId,
  getAccountByConnectAccountId,
  syncAccountToClerk,
} from '@/lib/accounts'
import { fulfillCheckoutSession } from '@/lib/checkout-fulfillment'
import { logAudit } from '@/lib/audit'

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

    // Pagamento de uma reserva de hóspede (charge direta na conta Connect do
    // anfitrião — event.account identifica de qual). Fallback fiável ao
    // preenchimento síncrono feito pela página de confirmação; idempotente.
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'payment' && event.account) {
        const result = await fulfillCheckoutSession(event.account, session.id)
        if (!result.ok) {
          console.error('[webhook] fulfillCheckoutSession falhou', session.id, result.reason)
          /* O hóspede pagou. Se a reserva não chegou a ser criada por uma falha
           * passageira — a base indisponível, um tempo esgotado — responder
           * "recebido" ao Stripe fecha a porta: o Stripe só repete o evento
           * quando não lhe respondem bem, e a única memória de que houve um
           * pagamento sem reserva ficava numa linha de consola que ninguém lê.
           * Dinheiro cobrado e calendário vazio, em silêncio.
           *
           * Falhar aqui de propósito faz o Stripe voltar durante três dias, e
           * a criação é idempotente pela sessão — repetir não duplica nada.
           * Os motivos definitivos (metadados inválidos, conflito já
           * reembolsado) não entram: repeti-los seria pedir ao Stripe que
           * tentasse para sempre uma coisa que nunca vai correr bem. */
          if (result.reason === 'error') {
            throw new Error(`fulfillment falhou para a sessão ${session.id}`)
          }
        }
        break
      }
      if (session.mode !== 'subscription') break

      const accountId   = session.metadata?.account_id
      const customerId  = session.customer as string
      const subId       = session.subscription as string

      if (!accountId || !subId) {
        // Alguém pagou e não sabemos a quem creditar. Silêncio aqui era uma
        // conta por activar que ninguém ia procurar.
        console.error('[webhook] subscrição sem account_id/subscription', session.id, { accountId, subId })
        break
      }

      const sub    = await stripe.subscriptions.retrieve(subId)
      const item   = sub.items.data[0]
      const priceId = item?.price.id ?? ''
      const plano  = priceToPlano(priceId)
      // No Stripe v22, current_period_end está no SubscriptionItem, não na Subscription
      const periodEnd = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      /* Pagou, portanto a conta fica activa. Mas se o preço não é nenhum dos
       * nossos, não se inventa um plano: mudar `plano`/`propriedades_max` com
       * um palpite é como se despromovia em silêncio quem comprou o mais
       * caro. Fica activo com o que tinha, e o caso vai para a auditoria. */
      await updateAccount(accountId, {
        estado:                'activo',
        ...(plano ? { plano, propriedades_max: PLAN_LIMITS[plano].propriedades_max } : {}),
        stripe_customer_id:    customerId,
        stripe_subscription_id: subId,
        stripe_price_id:       priceId,
        current_period_end:    periodEnd,
      })

      if (!plano) {
        console.error('[webhook] price sem plano correspondente:', priceId, 'conta', accountId)
        await logAudit({
          actorId: null,
          entidade: 'account',
          entidadeId: accountId,
          acao: 'plano_por_identificar',
          detalhes: { price_id: priceId, subscription_id: subId },
        })
      }

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
      const periodEnd  = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      const estado = estadoDaSubscricao(sub.status)

      await updateAccountByCustomerId(customerId, {
        estado,
        ...(plano ? { plano, propriedades_max: PLAN_LIMITS[plano].propriedades_max } : {}),
        stripe_subscription_id: sub.id,
        stripe_price_id:        priceId,
        current_period_end:     periodEnd,
      })

      if (!plano) {
        console.error('[webhook] price sem plano correspondente:', priceId, 'cliente', customerId)
      }

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

    // Estado da conta Stripe Connect do anfitrião (onboarding) mudou.
    case 'account.updated': {
      const acct = event.data.object as Stripe.Account
      const account = await getAccountByConnectAccountId(acct.id)
      if (!account) break

      await updateAccount(account.id, {
        stripe_connect_charges_enabled: !!acct.charges_enabled,
        stripe_connect_details_submitted: !!acct.details_submitted,
      })
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
