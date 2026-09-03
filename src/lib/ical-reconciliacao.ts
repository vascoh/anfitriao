import { textoDizIndisponivel } from './reservations'

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
 * ## E quando um cancelamento destes foi engano
 *
 * As travas acima reduzem a hipótese de cancelar por engano; não a eliminam.
 * Um feed que devolva 20 dos 21 eventos passa por todas elas, e a reserva que
 * ficou de fora era cancelada **para sempre**: o `uid_externo` já estava na
 * base, portanto a sincronização seguinte não a reimportava, e o estado
 * `cancelada` era intocável, portanto também não a corrigia. O quarto ficava a
 * dizer que estava livre numas datas em que ia mesmo chegar alguém — que é a
 * dupla reserva que todo este ficheiro existe para evitar, pela porta do lado.
 *
 * Por isso um cancelamento **feito pela sincronização** é reversível: se o UID
 * volta a aparecer no feed, a reserva volta a confirmada. Um cancelamento
 * **feito por uma pessoa** nunca é desfeito — a plataforma continuar a
 * publicar o evento não é razão para contrariar uma decisão do anfitrião.
 *
 * ## Quando o outro lado muda o UID sozinho
 *
 * A comparação por UID assume que o UID identifica a reserva. **O Amenitiz
 * não faz isso**: os UIDs dele são UUIDv5, ou seja, um hash do conteúdo do
 * evento — medido a 2026-09-03, o mesmo bloqueio passou de
 * `f199cc0d-…` (02→23 set) para `ea2b6a7e-…` (03→23 set) só por a data de
 * início ter avançado um dia.
 *
 * Com isso, o caminho «datas alteradas → atualizar» nunca dispara: o UID
 * antigo desaparece (cancela-se) e um novo aparece (importa-se). Uma linha
 * cancelada por dia, para sempre, e a reserva a perder tudo o que lhe estava
 * agarrado — histórico, estado do boletim, ligação à fatura.
 *
 * Por isso, antes de cancelar, procura-se entre os eventos **novos** um que
 * ocupe as mesmas datas. Se houver exatamente um, é a mesma reserva com outro
 * nome: atualizam-se as datas e o `uid_externo`, e o evento não é importado.
 *
 * Só se faz isto a **bloqueios**, e a candidato único. Entre reservas de
 * hóspedes, juntar duas que se parecem seria misturar pessoas diferentes —
 * e aí cancelar e criar, apesar de feio, não engana ninguém.
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
  /** O SUMMARY que o feed mandou. É o que diz se isto é um período fechado. */
  notas?: string | null
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
  paraAtualizar: Array<{
    id: string
    check_in: string
    check_out: string
    antes: string
    /** Presente quando o evento mudou de identidade — ver `absorvidos`. */
    novoUidExterno?: string
  }>
  paraCancelar: Array<{ id: string; uid_externo: string }>
  /** Canceladas pela sincronização que voltaram a constar do feed. */
  paraReativar: Array<{ id: string; check_in: string; check_out: string }>
  /**
   * UIDs de eventos que **não** se importam: já correspondem a uma reserva
   * local que mudou de identidade. Sem isto, o mesmo bloqueio entrava outra
   * vez como reserva nova.
   */
  absorvidos: Set<string>
}

/** Estados que a sincronização nunca mexe: já aconteceram ou já foram fechados à mão. */
const ESTADOS_INTOCAVEIS = ['no_show', 'checkin', 'checkout']

/** Marca escrita no histórico quando é a sincronização a cancelar. */
export const CANCELAMENTO_POR_SINCRONIZACAO = 'sincronizacao'

/**
 * O último cancelamento desta reserva foi da sincronização, ou de uma pessoa?
 *
 * Lê-se o histórico de trás para a frente e olha-se só para o cancelamento
 * mais recente: uma reserva que a sincronização cancelou, foi reativada e
 * depois o anfitrião cancelou à mão não pode voltar a ser reativada.
 */
export function canceladaPelaSincronizacao(historico: unknown): boolean {
  if (!Array.isArray(historico)) return false

  for (let i = historico.length - 1; i >= 0; i--) {
    const ev = historico[i]
    if (!ev || typeof ev !== 'object') continue
    const { tipo, origem } = ev as { tipo?: unknown; origem?: unknown }
    if (tipo !== 'cancelada') continue
    return origem === CANCELAMENTO_POR_SINCRONIZACAO
  }

  return false
}

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
  const paraReativar: Reconciliacao['paraReativar'] = []
  const absorvidos = new Set<string>()

  const esvaziouDeRepente = p.eventos.length === 0 && (p.contagemAnterior ?? 0) > 0
  const podeCancelar = p.todosOsFeedsOk && !esvaziouDeRepente

  /* Eventos que o lado local ainda não conhece — os candidatos a serem a nova
   * identidade de uma reserva cujo UID desapareceu. */
  const uidsLocais = new Set(
    p.locais.filter(l => l.uid_externo).map(l => uidDeOrigem(l.uid_externo)),
  )
  const novos = p.eventos.filter(e => !uidsLocais.has(e.uid))

  /** Intervalos meio-abertos: sair no dia em que outro entra não é sobreposição. */
  const sobrepoe = (a: EventoDoFeed, b: { check_in: string; check_out: string }) =>
    a.dtstart < b.check_out && a.dtend > b.check_in

  /**
   * O mesmo bloqueio, com outro UID?
   *
   * Só para bloqueios, e só com candidato único: ver a nota no topo. Um
   * evento já absorvido por outra reserva não volta a servir.
   */
  function mesmoBloqueioComOutroNome(local: ReservaImportada): EventoDoFeed | null {
    if (!textoDizIndisponivel(local.notas)) return null
    const candidatos = novos.filter(e => !absorvidos.has(e.uid) && sobrepoe(e, local))
    return candidatos.length === 1 ? candidatos[0] : null
  }

  for (const local of p.locais) {
    if (!local.uid_externo) continue
    if (ESTADOS_INTOCAVEIS.includes(local.estado)) continue

    const evento = porUid.get(uidDeOrigem(local.uid_externo))

    /* Cancelada: só há uma coisa a fazer-lhe, e é desfazer um engano nosso.
     * Reativar não depende de os feeds estarem todos bons — voltar a ocupar
     * uma data é o lado seguro do erro. Nada do passado é reativado, pela
     * mesma razão por que nada do passado é cancelado. */
    if (local.estado === 'cancelada') {
      if (!evento) continue
      if (local.check_out <= p.hoje) continue
      if (!canceladaPelaSincronizacao(local.historico)) continue

      paraReativar.push({ id: local.id, check_in: evento.dtstart, check_out: evento.dtend })
      continue
    }

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

    /* O UID desapareceu. Antes de cancelar: será o mesmo bloqueio com outro
     * nome? O Amenitiz muda o UID quando muda as datas — ver a nota no topo. */
    const rebatizado = mesmoBloqueioComOutroNome(local)
    if (rebatizado) {
      absorvidos.add(rebatizado.uid)
      const sep = local.uid_externo.indexOf('::')
      const prefixo = sep === -1 ? '' : local.uid_externo.slice(0, sep + 2)
      paraAtualizar.push({
        id: local.id,
        check_in: rebatizado.dtstart,
        check_out: rebatizado.dtend,
        antes: `${local.check_in} → ${local.check_out}`,
        novoUidExterno: `${prefixo}${rebatizado.uid}`,
      })
      continue
    }

    if (!podeCancelar) continue
    // Já terminou: o feed deixou de a publicar por ser antiga, não por ter sido cancelada.
    if (local.check_out <= p.hoje) continue

    paraCancelar.push({ id: local.id, uid_externo: local.uid_externo })
  }

  return { paraAtualizar, paraCancelar, paraReativar, absorvidos }
}
