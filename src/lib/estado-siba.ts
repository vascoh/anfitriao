/**
 * Estado da comunicação do boletim de alojamento, em linguagem de anfitrião.
 *
 * As quatro colunas de prova (`siba_status`, `siba_submitted_at`,
 * `siba_reference`, `siba_error`) eram escritas pela submissão e **não
 * apareciam em lado nenhum da interface**: quem comunicava não tinha como
 * saber, no dia seguinte, o que tinha sido comunicado e o que tinha falhado.
 * A prova existia na base de dados e não existia para quem responde por ela.
 *
 * Esta função é total de propósito — recebe a string tal como está na base,
 * incluindo valores que já não são escritos por código nenhum, e devolve
 * sempre algo mostrável. Um estado desconhecido conta como por comunicar, que
 * é o lado seguro do engano: leva o anfitrião a verificar, não a descansar.
 */

export type EstadoSiba = 'nao_submetido' | 'submetido' | 'falhou'

/** Como foi comunicado. O CSV é entregue à mão no portal; o outro é o web service. */
export type MetodoSiba = 'webservice' | 'csv' | null

export interface ReservaComSiba {
  siba_status?: string | null
  siba_submitted_at?: string | null
  siba_reference?: string | null
  siba_error?: string | null
  siba_metodo?: string | null
  check_in?: string | null
}

export interface ResumoSiba {
  chave: EstadoSiba
  /** Rótulo curto, para uma etiqueta. */
  texto: string
  /** Uma linha a explicar o que aconteceu, ou null se não houver nada a dizer. */
  detalhe: string | null
  tom: 'neutro' | 'bom' | 'mau'
  /** Verdadeiro quando o anfitrião ainda tem uma obrigação por cumprir. */
  porCumprir: boolean
}

function dataLegivel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function estadoSiba(reserva: ReservaComSiba): ResumoSiba {
  const bruto = reserva.siba_status ?? 'nao_submetido'

  if (bruto === 'falhou') {
    /* A tentativa falhada não apaga uma entrega anterior: se houver data, é de
     * uma comunicação que chegou a ser feita, e dizê-lo evita comunicar duas
     * vezes a mesma estadia. */
    const anterior = dataLegivel(reserva.siba_submitted_at)
    return {
      chave: 'falhou',
      texto: 'Falhou',
      detalhe: reserva.siba_error
        ? anterior
          ? `${reserva.siba_error} (houve uma entrega a ${anterior})`
          : reserva.siba_error
        : 'A última tentativa não foi aceite pelo SIBA.',
      tom: 'mau',
      porCumprir: true,
    }
  }

  if (bruto === 'submetido') {
    const quando = dataLegivel(reserva.siba_submitted_at)
    const comoTexto =
      reserva.siba_metodo === 'csv'
        ? 'entregue no portal'
        : reserva.siba_metodo === 'webservice'
          ? 'entregue automaticamente'
          : 'entregue'
    return {
      chave: 'submetido',
      texto: 'Comunicado',
      detalhe: quando ? `${comoTexto} a ${quando}` : comoTexto,
      tom: 'bom',
      porCumprir: false,
    }
  }

  return {
    chave: 'nao_submetido',
    texto: 'Por comunicar',
    detalhe: null,
    tom: 'neutro',
    porCumprir: true,
  }
}

/**
 * Prazo legal: o boletim é comunicado nas 24 horas seguintes à entrada
 * (art. 16.º da Lei 23/2007). Passado esse prazo, "por comunicar" deixa de ser
 * uma tarefa pendente e passa a ser uma coima possível — e a interface tem de
 * dizer as duas coisas de maneira diferente.
 */
export function estaEmAtraso(reserva: ReservaComSiba, hoje: string): boolean {
  if (!reserva.check_in) return false
  if (!estadoSiba(reserva).porCumprir) return false
  return reserva.check_in < hoje
}
