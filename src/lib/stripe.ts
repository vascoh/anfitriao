import Stripe from 'stripe'
import type { AccountPlano } from './accounts'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

// Mapeia Price ID do Stripe → plano interno
export function priceToPlano(priceId: string): AccountPlano {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  return 'starter' // fallback
}

// Limites por plano
export const PLAN_LIMITS: Record<AccountPlano, { propriedades_max: number }> = {
  trial:   { propriedades_max: 1 },
  starter: { propriedades_max: 3 },
  pro:     { propriedades_max: 10 },
}

export const PLAN_PRICE_IDS: Record<'starter' | 'pro', string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro:     process.env.STRIPE_PRO_PRICE_ID,
}
