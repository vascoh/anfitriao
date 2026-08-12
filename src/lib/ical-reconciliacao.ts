/**
 * O que fazer às reservas importadas quando os feeds mudam.
 *
 * A sincronização só sabia somar: importava eventos novos e ignorava tudo o
 * resto. Isso deixa dois buracos, e ambos custam dinheiro:
 *
 * 1. **Cancelamento na plataforma.** O evento desaparece do feed e a reserva
 *    local fica confirmada para sempre. O quarto continua bloqueado no
 *    calendário, o anfitrião recusa uma reserva direta para umas datas que
 *    estão livres, e a ocupação mente para cima.
 * 2. **Alteração de datas.** O UID é o mesmo, as datas mudam. A reserva local
 *    fica com as antigas — que é a receita para uma dupla reserva no dia em
 *    que alguém marcar por cima.
 *
 * Como o gestor de canais é a fonte de verdade do calendário
 * (`docs/SINCRONIZACAO.md`), o lado local tem de o seguir. Seguir às cegas é
 * que não pode, e por isso há travões — cada um deles é uma forma de perder
 * reservas que já aconteceu a alguém:
 *
 * - **Só se toca no que veio de feeds** (`uid_externo` preenchido). Reservas
 *   criadas à mão ou vindas do site não são deste âmbito.
 * - **Nada do passado é cancelado.** Os feeds deixam cair os eventos antigos
 *   passado algum tempo; sem esta regra, o histórico inteiro seria cancelado
 *   na primeira sincronização.
 * - **Uma união vazia não cancela nada.** Uma página de erro ou uma resposta
 *   truncada parecem-se com "não há reservas nenhumas".
 * - **Se algum feed falhou, não se cancela nada.** As reservas dele
 *   pareceriam desaparecidas só porque o servidor do outro lado esteve em
 *   baixo dez segundos.
 *
 * ## Porquê por propriedade, e não por feed
 *
 * A chave local é `${feed.id}::${uid}`, e o `feed.id` muda quando o anfitrião
 * remove e volta a adicionar o mesmo calendário — coisa que os próprios guias
 * mandam fazer quando o endereço muda. Comparar por feed deixava as reservas
 * antigas órfãs (nunca mais atualizadas) e reimportava tudo em duplicado.
 * Comparando o **UID de origem** contra a união dos eventos de todos os feeds
 * da propriedade, um feed re-adicionado é reconhecido como o mesmo.
 */

export interface ReservaImportada {
  id: string
  uid_externo: string
  check_in: string
  check_out: string
  estado: string
  /** Eventos da reserva; a sincronização acrescenta o que muda. */
  historico?: unknown
}

export interface EventoDoFeed {
  /** UID tal como vem do feed, sem o prefixo local. */
  uid: string
  dtstart: string
  dtend: string
}

export interface Reconciliacao {
  paraAtualizar: Array<{ id: string; check_in: string; check_out: string; antes: string }>
  paraCancelar: Array<{ id: string; uid_externo: string }>
}

/** Estados que a sincronização nunca mexe: já aconteceram ou já foram fechados à mão. */
const ESTADOS_INTOCAVEIS = ['cancelada', 'no_show', 'checkin', 'checkout']

/** O UID de origem, sem o `${feed.id}::` que a app lhe põe à frente. */
export function uidDeOrigem(uidExterno: string): string {
  const sep = uidExterno.indexOf('::')
  return sep === -1 ? uidExterno : uidExterno.slice(sep + 2)
}

export function reconciliarPropriedade(p: {
  /** Reservas locais com `uid_externo`, de qualquer feed desta propriedade. */
  locais: ReservaImportada[]
  /** Todos os eventos lidos agora, de todos os feeds da propriedade. */
  eventos: EventoDoFeed[]
  hoje: string
  /** Total de eventos que os feeds trouxeram da última vez. */
  contagemAnterior?: number | null
  /** Falso se algum feed falhou — nesse caso não se cancela nada. */
  todosOsFeedsOk: boolean
}): Reconciliacao {
  const porUid = new Map(p.eventos.map(e => [e.uid, e]))

  const paraAtualizar: Reconciliacao['paraAtualizar'] = []
  const paraCancelar: Reconciliacao['paraCancelar'] = []

  const esvaziouDeRepente = p.eventos.length === 0 && (p.contagemAnterior ?? 0) > 0
  const podeCancelar = p.todosOsFeedsOk && !esvaziouDeRepente

  for (const local of p.locais) {
    if (!local.uid_externo) continue
    if (ESTADOS_INTOCAVEIS.includes(local.estado)) continue

    const evento = porUid.get(uidDeOrigem(local.uid_externo))

    if (evento) {
      if (evento.dtstart !== local.check_in || evento.dtend !== local.check_out) {
        paraAtualizar.push({
          id: local.id,
          check_in: evento.dtstart,
          check_out: evento.dtend,
          antes: `${local.check_in} → ${local.check_out}`,
        })
      }
      continue
    }

    if (!podeCancelar) continue
    // Já terminou: o feed deixou de a publicar por ser antiga, não por ter sido cancelada.
    if (local.check_out <= p.hoje) continue

    paraCancelar.push({ id: local.id, uid_externo: local.uid_externo })
  }

  return { paraAtualizar, paraCancelar }
}
