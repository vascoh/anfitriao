import { estadoDoFeed, erroAmigavel, type EstadoCanal } from './canais'
import type { IcalFeed } from './types'
import { NOME_DO_LEITOR, HORAS_SEM_LEITURA_PREOCUPANTE, type LeituraIcal, type Leitor } from './ical-leitores'

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
          : 'Há mais de 6 horas que não há uma leitura com sucesso, e a sincronização tenta de 15 em 15 minutos. Pode ter sido uma falha passageira — sincroniza agora para confirmar.',
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

/* ── O outro sentido: plataformas que deixaram de ler o nosso calendário ──── */


/**
 * Só as plataformas que vendem noites. Um Google Calendar ou um serviço
 * desconhecido que deixe de ler não põe ninguém a dormir na rua.
 */
const LEITORES_QUE_VENDEM: Leitor[] = ['airbnb', 'booking', 'vrbo', 'amenitiz']

/**
 * Passado isto sem leitura deixa de se avisar: o anfitrião já foi avisado
 * vários dias seguidos, e o mais provável é ter desligado o anúncio de
 * propósito. Um aviso que nunca se cala ensina a ignorar todos.
 */
export const DIAS_ATE_DESISTIR_DO_AVISO = 7

export interface LeitorParado {
  ownerId: string
  /** «Quarto de Casal · Airbnb». */
  onde: string
  porque: string
}

/**
 * Uma plataforma que lia o calendário exportado e parou.
 *
 * É o sentido que o alerta dos feeds importados não vê: se o Airbnb deixa de
 * ler as nossas datas (endereço trocado, anúncio recriado, sincronização
 * desligada do lado dele), o que se vende no Booking ou no site deixa de lhe
 * chegar e ele vende a mesma noite. Sem o Amenitiz no meio, é a dupla reserva
 * clássica — e nada a assinala até ao dia em que acontece.
 */
export function leitoresParados(
  alojamentos: Array<AlojamentoComFeeds & { id: string }>,
  leituras: LeituraIcal[],
  agora: Date = new Date(),
): LeitorParado[] {
  const porId = new Map(alojamentos.map(a => [a.id, a]))
  /* Por alojamento e leitor, a leitura mais recente de qualquer dos feeds: o
   * Amenitiz pode ler o «diretas» e o Airbnb o completo do mesmo alojamento. */
  const ultima = new Map<string, LeituraIcal>()
  for (const l of leituras) {
    const k = `${l.propriedade_id}\u0000${l.leitor}`
    const atual = ultima.get(k)
    if (!atual || l.ultima_leitura > atual.ultima_leitura) ultima.set(k, l)
  }

  const parados: LeitorParado[] = []
  for (const l of ultima.values()) {
    if (!LEITORES_QUE_VENDEM.includes(l.leitor)) continue
    const a = porId.get(l.propriedade_id)
    if (!a?.owner_id || a.ativo === false) continue
    const horas = (agora.getTime() - new Date(l.ultima_leitura).getTime()) / 3_600_000
    if (horas <= HORAS_SEM_LEITURA_PREOCUPANTE || horas > DIAS_ATE_DESISTIR_DO_AVISO * 24) continue

    const nome = NOME_DO_LEITOR[l.leitor]
    const dias = Math.floor(horas / 24)
    parados.push({
      ownerId: a.owner_id,
      onde: `${a.nome} · ${nome}`,
      porque: `O ${nome} não lê as tuas datas há ${dias === 1 ? '1 dia' : `${dias} dias`}. O que vendes noutros canais pode não estar bloqueado lá. Confirma no ${nome} que o endereço do Anfitrião continua importado — se mudou, cola o atual (Canais → Levar as tuas datas).`,
    })
  }
  return parados.sort((a, b) => a.onde.localeCompare(b.onde, 'pt'))
}

export function agruparParadosPorAnfitriao(parados: LeitorParado[]): Map<string, LeitorParado[]> {
  const m = new Map<string, LeitorParado[]>()
  for (const p of parados) m.set(p.ownerId, [...(m.get(p.ownerId) ?? []), p])
  return m
}

export function resumoParadosParaPush(parados: LeitorParado[]): { title: string; body: string } {
  return {
    title: 'Uma plataforma deixou de ler as tuas datas',
    body: parados.length === 1
      ? `${parados[0].onde} — pode vender noites que já vendeste noutro lado.`
      : `${parados.length} calendários deixaram de ser lidos. Podem vender noites que já vendeste noutro lado.`,
  }
}
