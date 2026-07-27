import 'server-only'
import { stripe } from './stripe'
import { APP_URL } from './config'

/**
 * Pagamentos de hóspedes usam Stripe Connect com **charges diretas**: a
 * Checkout Session é criada diretamente na conta do anfitrião (`stripeAccount`
 * na chamada), não na conta da plataforma. O dinheiro nunca passa pela conta
 * da Anfitrião — nem a responsabilidade de disputa/reembolso. A plataforma
 * não cobra comissão (`application_fee_amount` nunca é definido), consistente
 * com a promessa "reservas diretas, sem comissões".
 */

export async function createConnectAccount(email: string): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
  return account.id
}

export async function createOnboardingLink(connectAccountId: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: connectAccountId,
    refresh_url: `${APP_URL}/conta/pagamentos?refresh=1`,
    return_url: `${APP_URL}/conta/pagamentos?onboarded=1`,
    type: 'account_onboarding',
  })
  return link.url
}

/** Cria uma Checkout Session de pagamento único, diretamente na conta do anfitrião. */
export async function createGuestCheckoutSession(params: {
  connectAccountId: string
  bookingId: string
  guestId: string
  propertyName: string
  amountCents: number
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}) {
  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: params.amountCents,
          product_data: { name: params.propertyName },
        },
        quantity: 1,
      }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      payment_intent_data: {
        metadata: params.metadata,
      },
    },
    { stripeAccount: params.connectAccountId },
  )
}

export async function retrieveGuestCheckoutSession(connectAccountId: string, sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: connectAccountId })
}
