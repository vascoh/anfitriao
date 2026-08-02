import Stripe from 'stripe'
import type { AccountPlano } from './accounts'
import type { PlanoPago } from './planos'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

// Mapeia Price ID do Stripe → plano interno
export function priceToPlano(priceId: string): AccountPlano {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_EMPRESA_PRICE_ID) return 'empresa'
  return 'starter' // fallback
}

export const PLAN_PRICE_IDS: Record<PlanoPago, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro:     process.env.STRIPE_PRO_PRICE_ID,
  empresa: process.env.STRIPE_EMPRESA_PRICE_ID,
}

/**
 * Planos que se podem comprar agora, sem falar com ninguém.
 *
 * Um plano sem Price ID configurado no Stripe não é comprável — mostrar-lhe
 * um botão de pagamento daria erro no checkout. A interface usa isto para
 * oferecer "falar connosco" no lugar.
 */
export function planoComprável(plano: PlanoPago): boolean {
  return Boolean(PLAN_PRICE_IDS[plano])
}

// Limites e preços vivem em `lib/planos.ts` — sem dependências de runtime, para
// poderem ser importados também do browser. Reexportados aqui por compatibilidade
// com quem já importava de '@/lib/stripe'; código novo deve importar de '@/lib/planos'.
export { PLAN_LIMITS, PLAN_PRICE_EUR } from './planos'
