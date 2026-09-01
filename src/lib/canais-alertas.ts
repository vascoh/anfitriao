import { estadoDoFeed, erroAmigavel, type EstadoCanal } from './canais'
import type { IcalFeed } from './types'

/**
 * Que canais é que estão partidos, e o que é que isso está a custar agora.
 *
 * ## Porque é que um crachá numa página não chega
 *
 * O estado de cada feed já se vê em `/canais`. O problema é que ninguém abre
 * `/canais` — abre-se quando se liga um calendário e nunca mais. Um feed que
 * parte fica com o crachá vermelho à espera de uma visita que não acontece, e
 * entretanto o calendário está parado desde o dia em que partiu.
 *
 * Desde que a disponibilidade passou a ser confirmada ao vivo no momento de
 * aceitar uma reserva (`lib/disponibilidade-ao-vivo.ts`), isto deixou de ser
 * só uma vista desatualizada: essa verificação **fecha por omissão**, portanto
 * um feed que não responde faz **recusar reservas diretas**. O anfitrião não
 * vê recusas — vê um mês fraco. É a diferença entre um aviso e uma fatura por
 * explicar, e é por isso que este alerta vai ao telemóvel e ao email em vez de
 * ficar à espera numa página.
 *
 * Para quem vender isto a outros anfitriões, é a mesma coisa vista do outro
 * lado: um cliente cujas reservas diretas param sem ele saber porquê não
 * apresenta uma queixa, cancela a subscrição.
 */

/** Estados que valem um aviso. `por_sincronizar` não: acabou de ser ligado. */
const ESTADOS_EM_RISCO: EstadoCanal[] = ['erro', 'desatualizado']

export interface AlojamentoComFeeds {
  nome: string
  owner_id?: string | null
  ativo?: boolean | null
  ical_feeds?: IcalFeed[] | null
}

export interface CanalEmRisco {
  ownerId: string
  /** «Quarto de Casal · Amenitiz» — o alojamento e o canal, como ele os nomeou. */
  onde: string
  estado: Extract<EstadoCanal, 'erro' | 'desatualizado'>
  /** Já traduzido para uma frase que diz o que fazer. */
  porque: string
}

/**
 * Um feed em erro é mais urgente do que um desatualizado, e por isso vem
 * primeiro: quem lê um aviso lê a primeira linha.
 */
const ORDEM: Record<string, number> = { erro: 0, desatualizado: 1 }

export function canaisEmRisco(
  alojamentos: AlojamentoComFeeds[],
  agora: Date = new Date(),
): CanalEmRisco[] {
  const riscos: CanalEmRisco[] = []

  for (const a of alojamentos) {
    // Sem dono não há a quem avisar; desativado não recusa reserva nenhuma.
    if (!a.owner_id) continue
    if (a.ativo === false) continue

    for (const feed of a.ical_feeds ?? []) {
      const estado = estadoDoFeed(feed, agora)
      if (!ESTADOS_EM_RISCO.includes(estado)) continue

      riscos.push({
        ownerId: a.owner_id,
        onde: `${a.nome} · ${feed.nome}`,
        estado: estado as CanalEmRisco['estado'],
        porque: feed.error
          ? erroAmigavel(feed.error)
          : 'Já passou mais de um dia desde a última leitura com sucesso. Pode ter sido uma falha passageira — sincroniza agora para confirmar.',
      })
    }
  }

  return riscos.sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado] || a.onde.localeCompare(b.onde, 'pt'))
}

/** Agrupado por anfitrião: um aviso por pessoa, nunca um por calendário. */
export function agruparPorAnfitriao(riscos: CanalEmRisco[]): Map<string, CanalEmRisco[]> {
  const porDono = new Map<string, CanalEmRisco[]>()
  for (const r of riscos) {
    const atual = porDono.get(r.ownerId) ?? []
    atual.push(r)
    porDono.set(r.ownerId, atual)
  }
  return porDono
}

/**
 * O aviso curto, para a notificação do telemóvel.
 *
 * Diz a consequência, não o estado. «Um calendário com erro» não move ninguém;
 * «podes estar a recusar reservas» move — e é verdade.
 */
export function resumoParaPush(riscos: CanalEmRisco[]): { title: string; body: string } {
  const temErro = riscos.some(r => r.estado === 'erro')

  return {
    title: temErro ? 'Um canal parou de responder' : 'Um canal está desatualizado',
    body: riscos.length === 1
      ? `${riscos[0].onde} — enquanto assim estiver, as reservas diretas nessas datas são recusadas.`
      : `${riscos.length} calendários precisam de atenção. Enquanto assim estiverem, as reservas diretas são recusadas.`,
  }
}
