import Stripe from 'stripe'
import type { AccountPlano } from './accounts'
import type { PlanoPago } from './planos'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

/**
 * Price ID do Stripe → plano interno. `null` quando não é nenhum dos nossos.
 *
 * Devolvia `'starter'` como fallback, e isso **fazia um cliente pagar 99 € e
 * ficar com o limite de 3 unidades**: basta o `STRIPE_EMPRESA_PRICE_ID` não
 * estar definido no ambiente (é o caso em produção enquanto o plano Empresa
 * não tiver preço no Stripe) para uma subscrição legítima cair no fallback.
 * O mesmo aconteceria com um preço substituído ou criado à mão no painel.
 *
 * Adivinhar aqui é sempre pior do que não saber: quem recebe a resposta pode
 * manter o que a conta já tem e pedir olhos humanos, mas não pode desfazer um
 * despromoção silenciosa que ninguém viu acontecer.
 */
export function priceToPlano(priceId: string): AccountPlano | null {
  if (priceId && priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId && priceId === process.env.STRIPE_EMPRESA_PRICE_ID) return 'empresa'
  return null
}

/** Estado interno da conta para cada estado de subscrição do Stripe. */
export type EstadoConta = 'activo' | 'suspenso' | 'cancelado'

/**
 * Traduz o estado da subscrição do Stripe para o da conta.
 *
 * O mapa anterior era `active → activo`, `past_due → suspenso` e **tudo o
 * resto → activo**. Ou seja: uma subscrição `canceled`, `unpaid` ou
 * `incomplete_expired` deixava a conta com acesso completo. Um checkout
 * abandonado a meio da autenticação do cartão (`incomplete`) dava conta
 * activa sem nunca ter havido pagamento.
 *
 * O que não se decide aqui é **quando** suspender por falha de pagamento: o
 * Stripe tenta várias vezes ao longo de dias, e cortar o acesso à primeira
 * tentativa falhada é decisão comercial, não técnica.
 */
export function estadoDaSubscricao(status: string): EstadoConta {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'activo'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'suspenso'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelado'
    default:
      // Estado novo do Stripe: suspender é conservador e reversível; deixar
      // activo é dar acesso a quem talvez não esteja a pagar.
      console.error('[stripe] estado de subscrição desconhecido:', status)
      return 'suspenso'
  }
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
