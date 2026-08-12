import {
  PLAN_LIMITS,
  PLANOS_PAGOS,
  precoMensal,
  type PlanoPago,
} from './planos'

/**
 * Comparação entre pagar **por alojamento** e pagar **por conta**.
 *
 * É a única vantagem de preço que o Anfitrião tem sobre a concorrência
 * portuguesa, e a que se percebe pior numa tabela: com um apartamento a
 * diferença é nenhuma, com oito é o preço de um jantar por mês. Uma
 * calculadora mostra isso em dois segundos; uma tabela obriga a fazer contas
 * de cabeça.
 *
 * ## O preço do outro lado é escrito pelo visitante
 *
 * Não se publicam aqui preços de concorrentes. Mudam sem aviso, variam com
 * descontos e módulos, e publicar um número errado sobre outra empresa é uma
 * alegação comparativa que não se consegue sustentar (a mesma razão que levou
 * o "+12 % de ocupação" a sair da landing). O visitante escreve o que **paga
 * hoje** — número que ele conhece e nós não — e a conta é feita sobre isso.
 *
 * ## Quando não compensa, diz-se
 *
 * Com uma unidade só, quase nunca compensa, e a calculadora di-lo. Uma
 * ferramenta que dá sempre a mesma resposta não é uma calculadora, é um
 * cartaz — e quem faz a conta e vê o resultado a favor do vendedor em todos
 * os cenários deixa de acreditar no resto da página.
 */

/** Preço por alojamento sugerido por omissão, em euros. Ponto de partida editável. */
export const PRECO_POR_UNIDADE_OMISSAO = 10

/** Limites de entrada — evitam gráficos absurdos e divisões por zero. */
export const MAX_UNIDADES = 40
export const MAX_PRECO_UNIDADE = 100

export interface EntradaComparacao {
  /** Quantos quartos ou alojamentos o visitante gere. */
  unidades: number
  /** Quanto paga hoje, por alojamento, por mês. */
  precoPorUnidade: number
  /** Comparar com o preço anual do Anfitrião (mais barato) ou o mensal. */
  anual?: boolean
}

export interface ResultadoComparacao {
  unidades: number
  /** Plano que serve este número de unidades; `null` acima do maior plano. */
  plano: PlanoPago | null
  /** Custo mensal no Anfitrião. `null` quando é preciso falar connosco. */
  custoAnfitriao: number | null
  /** Custo mensal a pagar por alojamento. */
  custoPorUnidade: number
  /** Diferença mensal. Negativa quando o Anfitrião fica mais caro. */
  poupancaMes: number
  poupancaAno: number
  /** Quanto dá, por alojamento, no plano do Anfitrião. */
  precoEfetivoPorUnidade: number | null
  /** True quando pagar por conta sai mais caro ou igual — e diz-se na mesma. */
  naoCompensa: boolean
}

function limitar(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min
  return Math.min(Math.max(Math.round(valor * 100) / 100, min), max)
}

/**
 * O plano mais barato que comporta este número de unidades.
 * `null` acima do maior — aí a resposta honesta é falar connosco, não empurrar
 * o Empresa para alguém que ele não serve.
 */
export function planoParaUnidades(unidades: number): PlanoPago | null {
  const necessarias = Math.max(1, Math.ceil(unidades))
  return (
    PLANOS_PAGOS.find(p => PLAN_LIMITS[p].propriedades_max >= necessarias) ?? null
  )
}

export function compararCusto(entrada: EntradaComparacao): ResultadoComparacao {
  const unidades = Math.round(limitar(entrada.unidades, 1, MAX_UNIDADES))
  const precoPorUnidade = limitar(entrada.precoPorUnidade, 0, MAX_PRECO_UNIDADE)

  const plano = planoParaUnidades(unidades)
  const custoAnfitriao = plano ? precoMensal(plano, entrada.anual ?? false) : null
  const custoPorUnidade = Math.round(unidades * precoPorUnidade * 100) / 100

  const poupancaMes =
    custoAnfitriao === null ? 0 : Math.round((custoPorUnidade - custoAnfitriao) * 100) / 100

  return {
    unidades,
    plano,
    custoAnfitriao,
    custoPorUnidade,
    poupancaMes,
    poupancaAno: Math.round(poupancaMes * 12 * 100) / 100,
    precoEfetivoPorUnidade:
      custoAnfitriao === null ? null : Math.round((custoAnfitriao / unidades) * 100) / 100,
    naoCompensa: custoAnfitriao !== null && poupancaMes <= 0,
  }
}
