/**
 * Limites do que uma regra de preço ou tarifa pode conter.
 *
 * As rotas guardavam `{ ...body, owner_id }` sem olhar para os números. Um
 * `desconto_pct` de −150 dava preços negativos; um intervalo com o fim antes
 * do início criava uma regra que nunca se aplica e que o anfitrião fica a
 * pensar que está a funcionar; um `preco_noite` de 1e9 estraga qualquer
 * relatório. Nada disto precisa de má-fé — a atualização em massa aceitava
 * escrever o primeiro caso a partir da interface.
 *
 * O piso de zero no preço vive em `calculatePriceWithRules`, porque é por lá
 * que passam todos os caminhos. Isto aqui é a outra metade: impedir que o
 * disparate entre na base de dados.
 */

/** −100 % é dar de graça; acima de +500 % é engano de dedo, não estratégia. */
export const DESCONTO_MIN = -100
export const DESCONTO_MAX = 500
export const PRECO_MAX = 100_000
export const NOITES_MAX = 365

export interface ProblemaValidacao {
  campo: string
  mensagem: string
}

function numeroValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Devolve o primeiro problema encontrado, ou `null` quando está tudo bem. */
export function validarRegraPreco(r: Record<string, unknown>): ProblemaValidacao | null {
  if (r.desconto_pct != null) {
    if (!numeroValido(r.desconto_pct)) return { campo: 'desconto_pct', mensagem: 'Percentagem inválida.' }
    if (r.desconto_pct < DESCONTO_MIN || r.desconto_pct > DESCONTO_MAX) {
      return {
        campo: 'desconto_pct',
        mensagem: `A percentagem tem de estar entre ${DESCONTO_MIN}% e ${DESCONTO_MAX}%.`,
      }
    }
  }

  for (const campo of ['preco_noite', 'taxa_limpeza', 'suplemento_valor'] as const) {
    const v = r[campo]
    if (v == null) continue
    if (!numeroValido(v)) return { campo, mensagem: 'Valor inválido.' }
    if (v < 0) return { campo, mensagem: 'O valor não pode ser negativo.' }
    if (v > PRECO_MAX) return { campo, mensagem: `O valor não pode passar de ${PRECO_MAX} €.` }
  }

  for (const campo of ['min_noites', 'max_noites'] as const) {
    const v = r[campo]
    if (v == null) continue
    if (!numeroValido(v) || !Number.isInteger(v) || v < 1 || v > NOITES_MAX) {
      return { campo, mensagem: `Número de noites inválido (1 a ${NOITES_MAX}).` }
    }
  }

  if (numeroValido(r.min_noites) && numeroValido(r.max_noites) && r.min_noites > r.max_noites) {
    return { campo: 'max_noites', mensagem: 'O máximo de noites não pode ser menor que o mínimo.' }
  }

  /* Datas invertidas não dão erro nenhum: dão uma regra que nunca se aplica,
   * e o anfitrião fica a olhar para uma promoção que não existe. */
  const inicio = r.data_inicio
  const fim = r.data_fim
  if (typeof inicio === 'string' && typeof fim === 'string' && inicio && fim && inicio > fim) {
    return { campo: 'data_fim', mensagem: 'A data de fim é anterior à de início.' }
  }

  if (r.dias_semana != null) {
    if (!Array.isArray(r.dias_semana)) return { campo: 'dias_semana', mensagem: 'Dias da semana inválidos.' }
    if (r.dias_semana.some(d => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) {
      return { campo: 'dias_semana', mensagem: 'Dias da semana inválidos.' }
    }
  }

  if (r.prioridade != null && (!numeroValido(r.prioridade) || !Number.isInteger(r.prioridade))) {
    return { campo: 'prioridade', mensagem: 'Prioridade inválida.' }
  }

  return null
}

/** Comissão de plataforma: uma percentagem entre 0 e 100. */
export function validarComissao(v: unknown): ProblemaValidacao | null {
  if (v == null) return null
  if (!numeroValido(v) || v < 0 || v > 100) {
    return { campo: 'comissao_pct', mensagem: 'A comissão tem de estar entre 0% e 100%.' }
  }
  return null
}

/** Multiplicador de plataforma: 0,1× a 10× — fora disto é engano. */
export function validarMultiplicador(v: unknown): ProblemaValidacao | null {
  if (v == null) return null
  if (!numeroValido(v) || v < 0.1 || v > 10) {
    return { campo: 'multiplicador', mensagem: 'O multiplicador tem de estar entre 0,1 e 10.' }
  }
  return null
}
