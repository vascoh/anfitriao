import type { AccountPlano } from './accounts'

/**
 * Factos comerciais dos planos — limites e preços de exibição.
 *
 * Este módulo é deliberadamente **sem dependências de runtime**: só importa um
 * tipo (apagado no build). É por isso que pode ser importado tanto do servidor
 * como de componentes `'use client'` — ao contrário de `lib/stripe.ts`, que
 * instancia o SDK com `STRIPE_SECRET_KEY` e nunca pode chegar ao browser.
 *
 * ⚠️ A fonte de verdade do valor **cobrado** é sempre o Price ID no Stripe.
 * Estes números servem apenas para mostrar. Se mudarem aqui, têm de mudar
 * também no Stripe — e vice-versa.
 */

/** Limites de utilização por plano. */
export const PLAN_LIMITS: Record<AccountPlano, { propriedades_max: number }> = {
  trial:   { propriedades_max: 1 },
  starter: { propriedades_max: 3 },
  pro:     { propriedades_max: 10 },
}

/** Preço mensal em euros, na subscrição mensal. */
export const PLAN_PRICE_EUR: Record<AccountPlano, number> = {
  trial:   0,
  starter: 19,
  pro:     39,
}

/** Preço mensal em euros, quando pago anualmente. */
export const PLAN_PRICE_EUR_ANUAL: Record<'starter' | 'pro', number> = {
  starter: 15,
  pro:     32,
}

/** Rótulo do desconto anual mostrado no alternador de periodicidade. */
export const DESCONTO_ANUAL_LABEL = '−20%'

/** Duração do período experimental, em dias. */
export const TRIAL_DIAS = 14

/** Preço a mostrar para um plano, conforme a periodicidade escolhida. */
export function precoMensal(plano: 'starter' | 'pro', anual: boolean): number {
  return anual ? PLAN_PRICE_EUR_ANUAL[plano] : PLAN_PRICE_EUR[plano]
}

/** "1 propriedade" / "até 3 propriedades" — para copy que não pode divergir dos limites. */
export function limiteDePropriedades(plano: AccountPlano): string {
  const max = PLAN_LIMITS[plano].propriedades_max
  return max === 1 ? '1 propriedade' : `até ${max} propriedades`
}

/** O mesmo, com maiúscula inicial — para começo de frase ou item de lista. */
export function limiteDePropriedadesCapitalizado(plano: AccountPlano): string {
  const texto = limiteDePropriedades(plano)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
