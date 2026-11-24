/**
 * Quem está a ler o calendário que exportamos (`/api/ical/[propertyId]`).
 *
 * O anfitrião cola o endereço no Airbnb, no Booking ou no gestor de canais e
 * fica sem saber se resultou: as plataformas não confirmam nada, e um endereço
 * mal colado só se descobre no dia de uma dupla reserva. Cada leitura do feed
 * regista quem leu (pelo user-agent) e quando; `/canais` mostra-o.
 *
 * O reconhecimento é por palavras do user-agent, de propósito largo: guarda-se
 * também o user-agent (truncado) para se afinar a lista com o que aparecer de
 * verdade, em vez de a adivinhar. O IP nunca se guarda.
 */

export type Leitor = 'airbnb' | 'booking' | 'vrbo' | 'amenitiz' | 'google' | 'apple' | 'outro'

export const NOME_DO_LEITOR: Record<Leitor, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking',
  vrbo: 'Vrbo',
  amenitiz: 'Amenitiz',
  google: 'Google Calendar',
  apple: 'Calendário Apple',
  outro: 'Outro serviço',
}

const PADROES: Array<[Leitor, RegExp]> = [
  ['airbnb', /airbnb/i],
  ['booking', /booking\.?com|\bbooking\b/i],
  ['vrbo', /vrbo|homeaway|expedia/i],
  ['amenitiz', /amenitiz/i],
  ['google', /google-calendar|googlecalendar|google.*importer/i],
  ['apple', /\bical\/|calendaragent|dataaccessd|icalendar.*apple/i],
]

/**
 * `null` = não se regista. É o caso de um navegador — o anfitrião a abrir o
 * endereço para ver o que tem — que contaria como «alguém leu» sem ninguém
 * ter ligado nada. Um navegador reconhece-se por mandar `Accept-Language`,
 * que os servidores das plataformas não mandam.
 */
export function leitorDoPedido(userAgent: string | null, acceptLanguage: string | null): Leitor | null {
  const ua = (userAgent ?? '').trim()
  for (const [leitor, re] of PADROES) if (re.test(ua)) return leitor
  if (acceptLanguage && /mozilla/i.test(ua)) return null
  return 'outro'
}

/** O user-agent que se guarda: só o começo, sem caracteres de controlo. */
export function userAgentParaGuardar(ua: string | null): string | null {
  if (!ua) return null
  return ua.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200)
}

export interface LeituraIcal {
  propriedade_id: string
  leitor: Leitor
  origem: 'todas' | 'diretas'
  ultima_leitura: string
}

/** Acima disto sem leitura, a plataforma provavelmente deixou de ler (endereço trocado, anúncio desligado). */
export const HORAS_SEM_LEITURA_PREOCUPANTE = 24

/** «há 12 min», «há 3 h», «há 2 dias». */
export function haQuantoTempo(iso: string, agora: Date): string {
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.round(h / 24)} dias`
}

export function leituraAtrasada(iso: string, agora: Date): boolean {
  return agora.getTime() - new Date(iso).getTime() > HORAS_SEM_LEITURA_PREOCUPANTE * 3_600_000
}

/** As leituras de um alojamento, a mais recente primeiro, um leitor por linha (o feed mais recente). */
export function leiturasDoAlojamento(todas: LeituraIcal[], propriedadeId: string): LeituraIcal[] {
  const porLeitor = new Map<Leitor, LeituraIcal>()
  for (const l of todas) {
    if (l.propriedade_id !== propriedadeId) continue
    const atual = porLeitor.get(l.leitor)
    if (!atual || l.ultima_leitura > atual.ultima_leitura) porLeitor.set(l.leitor, l)
  }
  return [...porLeitor.values()].sort((a, b) => b.ultima_leitura.localeCompare(a.ultima_leitura))
}

/**
 * Um gestor de canais importa os nossos calendários, mas ninguém lê o feed
 * das reservas diretas deste alojamento.
 *
 * Com o Amenitiz ligado, a topologia certa tem dois sentidos: ele manda-nos as
 * reservas das plataformas (feed importado) e lê-nos as do site
 * (`?origem=diretas`). Só o primeiro é visível — está em `ical_feeds`. O
 * segundo fica do lado dele, e quando falta ninguém dá por isso: o site aceita
 * uma reserva e o Amenitiz continua a vender a mesma noite no Airbnb.
 *
 * Diz-se «ainda não vimos ler», nunca «não está ligado»: só sabemos o que
 * chegou cá, e a primeira leitura de um endereço acabado de colar pode
 * demorar horas.
 */
export function gestorSemLerAsDiretas(
  urlsImportadas: string[],
  leiturasDoAlojamento: Pick<LeituraIcal, 'origem'>[],
  eGestor: (url: string) => boolean,
): boolean {
  if (!urlsImportadas.some(eGestor)) return false
  return !leiturasDoAlojamento.some(l => l.origem === 'diretas')
}
