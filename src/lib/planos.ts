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
 *
 * ## A unidade de medida é o quarto alugável, não a propriedade
 *
 * O limite conta **unidades alugáveis** (`contarUnidadesReservaveis`), não
 * linhas na tabela `properties`. Uma casa com três quartos são três unidades,
 * porque é o que se aluga e dá o mesmo trabalho que três apartamentos. Contar
 * propriedades de topo — como se fazia — deixava um hotel de 40 quartos caber
 * no plano mais barato, já que os quartos são filhos e não contavam.
 */

/** Limites de utilização por plano, em unidades alugáveis. */
export const PLAN_LIMITS: Record<AccountPlano, { propriedades_max: number }> = {
  trial:   { propriedades_max: 1 },
  starter: { propriedades_max: 3 },
  pro:     { propriedades_max: 10 },
  /**
   * Empresa: guest houses, hostels, e hotéis pequenos e médios.
   *
   * 40 é onde a curva muda de figura — acima disso entra-se em cadeias, que
   * precisam de equipas com permissões e portal de proprietário, coisas que o
   * produto ainda não tem. Prometer "ilimitado" seria vender o que não se
   * entrega; acima de 40 fala-se connosco, e é honesto.
   */
  empresa: { propriedades_max: 40 },
}

/** Preço mensal em euros, na subscrição mensal. */
export const PLAN_PRICE_EUR: Record<AccountPlano, number> = {
  trial:   0,
  starter: 19,
  pro:     39,
  empresa: 99,
}

/** Planos que se compram. */
export type PlanoPago = 'starter' | 'pro' | 'empresa'

export const PLANOS_PAGOS: readonly PlanoPago[] = ['starter', 'pro', 'empresa'] as const

/** Preço mensal em euros, quando pago anualmente. */
export const PLAN_PRICE_EUR_ANUAL: Record<PlanoPago, number> = {
  starter: 15,
  pro:     32,
  empresa: 79,
}

/** Rótulo do desconto anual mostrado no alternador de periodicidade. */
export const DESCONTO_ANUAL_LABEL = '−20%'

/** Duração do período experimental, em dias. */
export const TRIAL_DIAS = 14

/** Nome comercial de cada plano. */
export const PLAN_NOME: Record<AccountPlano, string> = {
  trial:   'Trial',
  starter: 'Starter',
  pro:     'Pro',
  empresa: 'Empresa',
}

/** Preço a mostrar para um plano, conforme a periodicidade escolhida. */
export function precoMensal(plano: PlanoPago, anual: boolean): number {
  return anual ? PLAN_PRICE_EUR_ANUAL[plano] : PLAN_PRICE_EUR[plano]
}

/**
 * "1 quarto ou alojamento" / "até 10 quartos ou alojamentos".
 *
 * A copy diz sempre as duas palavras porque o público é o dos dois: quem tem
 * apartamentos inteiros conta alojamentos, quem tem uma guest house conta
 * quartos — e a unidade de medida passou a ser a mesma para ambos.
 */
export function limiteDeUnidades(plano: AccountPlano): string {
  const max = PLAN_LIMITS[plano].propriedades_max
  return max === 1 ? '1 quarto ou alojamento' : `até ${max} quartos ou alojamentos`
}

/** O mesmo, com maiúscula inicial — para começo de frase ou item de lista. */
export function limiteDeUnidadesCapitalizado(plano: AccountPlano): string {
  const texto = limiteDeUnidades(plano)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Preço por unidade, para comparar com quem cobra por listing.
 *
 * É o argumento comercial mais forte que existe — no Empresa dá menos de
 * 2,50 € por quarto, contra os 10 a 20 € por unidade da concorrência — e
 * convém não o calcular à mão em cada sítio onde aparece.
 */
export function precoPorUnidade(plano: PlanoPago, anual = false): number {
  const preco = precoMensal(plano, anual)
  return Math.round((preco / PLAN_LIMITS[plano].propriedades_max) * 100) / 100
}
