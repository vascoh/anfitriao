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

export const PLAN_PRICE_IDS: Record<'starter' | 'pro', string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro:     process.env.STRIPE_PRO_PRICE_ID,
}

// Limites e preços vivem em `lib/planos.ts` — sem dependências de runtime, para
// poderem ser importados também do browser. Reexportados aqui por compatibilidade
// com quem já importava de '@/lib/stripe'; código novo deve importar de '@/lib/planos'.
export { PLAN_LIMITS, PLAN_PRICE_EUR } from './planos'
