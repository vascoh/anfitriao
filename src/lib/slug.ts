import { semAcentos } from './nomes'

/**
 * Endereço do site de cada anfitrião: `anfitrioes.pt/r/<slug>`.
 *
 * ## Porque é que o vazio tem de ser `null`
 *
 * A coluna tem `UNIQUE`. Em Postgres, dois `NULL` não colidem — mas duas
 * cadeias vazias colidem. A interface guardava `''` quando o anfitrião
 * apagava o campo, o que funciona enquanto houver **um** cliente: o segundo
 * que apagasse o endereço deixava de conseguir gravar seja o que fosse na
 * página, com um "Erro ao guardar" que não explica nada e não tem nada a ver
 * com o que ele estava a fazer.
 *
 * ## Porque é que a normalização vive aqui
 *
 * O formulário já limpava o que se escreve, mas a API aceitava qualquer
 * coisa. Um `slug` com barra — `a/b` — passa a dar um endereço que não
 * corresponde a rota nenhuma: o site fica inacessível e o anfitrião não tem
 * como perceber porquê. Regra num sítio só, usada pelos dois lados.
 */

export const SLUG_MIN = 3
export const SLUG_MAX = 40

/**
 * Devolve o slug em forma canónica, ou `null` quando não há slug nenhum.
 * Não valida o comprimento — para isso há `validarSlug`.
 */
export function normalizarSlug(valor: unknown): string | null {
  if (typeof valor !== 'string') return null

  const limpo = semAcentos(valor)
    .trim()
    .toLowerCase()
    // acentos: "praça" → "praca"
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-$/, '') // o corte pode ter deixado um hífen no fim

  return limpo || null
}

/** Mensagem de erro, ou `null` quando o slug serve. */
export function validarSlug(slug: string | null): string | null {
  if (slug === null) return null // sem endereço próprio é permitido
  if (slug.length < SLUG_MIN) return `O endereço tem de ter pelo menos ${SLUG_MIN} caracteres.`
  if (slug.length > SLUG_MAX) return `O endereço não pode passar de ${SLUG_MAX} caracteres.`
  return null
}
