/**
 * Comparação de nomes de concelho.
 *
 * `properties.cidade` é um campo de texto livre — o anfitrião escreve o que
 * quiser, e duas listas fechadas dependem de acertar com o que lá está: as
 * regras da taxa municipal turística (`taxa-turistica.ts`) e os concelhos das
 * regiões autónomas que determinam a taxa de IVA (`faturacao/iva.ts`).
 *
 * Ambas comparavam só em minúsculas, o que deixa de fora a diferença mais
 * banal num teclado português: o acento. «Loule» não encontrava a regra de
 * «Loulé» e a taxa turística nunca era cobrada nem declarada; «Camara de
 * Lobos» não encontrava a Madeira e a fatura saía a 6 % em vez de 5 %.
 *
 * É o mesmo raciocínio que `nomes.ts` já fazia para nomes de pessoas
 * («deliberadamente tolerante ao que muda entre dois preenchimentos») —
 * nunca tinha sido aplicado a concelhos.
 *
 * Tolerante a acentos, maiúsculas e espaços a mais; cega a tudo o resto:
 * «Lagoa» e «Lagoa dos Açores» continuam concelhos diferentes.
 */

import { semAcentos } from './nomes'

/** Forma comparável de um concelho: "  CÂMARA  de Lobos " → "camara de lobos". */
export function chaveDeConcelho(concelho: unknown): string {
  if (typeof concelho !== 'string') return ''
  return semAcentos(concelho).toLowerCase().replace(/\s+/g, ' ').trim()
}
