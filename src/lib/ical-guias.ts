import type { BookingSource } from './types'

/**
 * Instruções para obter o URL de exportação iCal de cada plataforma.
 *
 * Vivem em dados e não em JSX porque mudam com a interface das plataformas e
 * porque assim se testam. O que aqui está foi verificado contra a documentação
 * pública em 2026-07-30 — quando uma plataforma mexer nos menus, é este
 * ficheiro que se corrige, num sítio só.
 *
 * ⚠️ O que o iCal **não** transporta, em nenhuma plataforma: preços, estadia
 * mínima ou máxima, restrições de dia de chegada e de saída. Só datas ocupadas.
 * É uma limitação do formato, não desta aplicação — ver docs/SINCRONIZACAO.md.
 */

export interface GuiaIcal {
  /** Nome da fonte, como aparece ao anfitrião. */
  label: string
  /** Caminho no menu da plataforma, do primeiro clique ao último. */
  passos: string[]
  /** Exemplo do endereço, para reconhecer que se copiou a coisa certa. */
  exemploUrl: string
  /** Avisos específicos desta fonte. */
  notas?: string[]
}

export const GUIAS: Record<Exclude<BookingSource, 'direto'>, GuiaIcal> = {
  airbnb: {
    label: 'Airbnb',
    passos: [
      'Abre o Airbnb no computador e entra em Calendário.',
      'Escolhe o anúncio, se tiveres mais do que um.',
      'Na coluna da direita, abre Disponibilidade → Sincronizar calendários.',
      'Carrega em Exportar calendário e copia o endereço que aparece.',
    ],
    exemploUrl: 'https://www.airbnb.pt/calendar/ical/12345678.ics?s=abcdef…',
    notas: [
      'O endereço serve de senha: quem o tiver vê as tuas datas ocupadas. Não o publiques.',
      'Se tiveres o site do Airbnb em português, o endereço é airbnb.pt — também é aceite.',
    ],
  },
  booking: {
    label: 'Booking.com',
    passos: [
      'Entra na Extranet do Booking.com.',
      'Abre Tarifas e disponibilidade → Sincronização de calendários.',
      'Escolhe o tipo de quarto.',
      'Copia o endereço na secção de exportação.',
    ],
    exemploUrl: 'https://ical.booking.com/v1/export?t=abcdef…',
    notas: ['É preciso um endereço por tipo de quarto — não há um único para a propriedade toda.'],
  },
  expedia: {
    label: 'Expedia',
    passos: [
      'Entra no Partner Central da Expedia.',
      'Abre Alojamento → Calendário.',
      'Procura a opção de exportação/sincronização de calendário e copia o endereço.',
    ],
    exemploUrl: 'https://www.expedia.com/…/ical/…',
  },
  vrbo: {
    label: 'Vrbo',
    passos: [
      'Entra no painel do Vrbo.',
      'Abre Calendário → Importar/Exportar (Reservation settings).',
      'Copia o endereço em Export calendar.',
    ],
    exemploUrl: 'https://www.vrbo.com/icalendar/…ics',
  },
  outro: {
    label: 'Outra plataforma ou gestor de canais',
    passos: [
      'Procura na plataforma uma secção chamada iCal, Sincronização de calendários ou Exportar calendário.',
      'Copia o endereço de exportação (começa por https:// e costuma acabar em .ics).',
    ],
    exemploUrl: 'https://…/calendario.ics',
    notas: [
      'Se o endereço for recusado, a mensagem diz qual é o domínio — basta pedir para ser acrescentado à lista.',
    ],
  },
}

/**
 * O caminho inverso: onde **colar** o endereço que o Anfitrião publica.
 *
 * Sem isto a ligação é de sentido único e engana. Importar traz para cá as
 * reservas da plataforma, mas nada impede essa mesma plataforma de vender uma
 * noite que já foi vendida no teu site ou noutra plataforma — só o feed que
 * sai daqui a impede. Quem só faz metade fica a achar que está protegido de
 * uma dupla reserva quando não está.
 */
export interface GuiaExportacao {
  label: string
  passos: string[]
  notas?: string[]
}

export const GUIAS_EXPORTAR: Record<Exclude<BookingSource, 'direto'>, GuiaExportacao> = {
  airbnb: {
    label: 'Airbnb',
    passos: [
      'Abre o Airbnb no computador e entra em Calendário.',
      'Escolhe o anúncio, se tiveres mais do que um.',
      'Na coluna da direita, abre Disponibilidade → Sincronizar calendários.',
      'Carrega em Importar calendário.',
      'Cola aqui o endereço do Anfitrião e dá-lhe um nome — por exemplo, «Anfitrião».',
    ],
    notas: ['O Airbnb costuma ler o calendário de duas em duas horas — não esperes uma atualização imediata.'],
  },
  booking: {
    label: 'Booking.com',
    passos: [
      'Entra na Extranet do Booking.com.',
      'Abre Tarifas e disponibilidade → Sincronização de calendários.',
      'Escolhe o tipo de quarto e carrega em Ligar outro calendário.',
      'Cola o endereço do Anfitrião e confirma.',
    ],
    notas: ['Tem de ser feito para cada tipo de quarto, um a um.'],
  },
  expedia: {
    label: 'Expedia',
    passos: [
      'Entra no Partner Central da Expedia.',
      'Abre Alojamento → Calendário.',
      'Procura a opção de importação de calendário e cola o endereço do Anfitrião.',
    ],
  },
  vrbo: {
    label: 'Vrbo',
    passos: [
      'Entra no painel do Vrbo.',
      'Abre Calendário → Importar/Exportar.',
      'Carrega em Import calendar e cola o endereço do Anfitrião.',
    ],
  },
  outro: {
    label: 'Gestor de canais ou outra plataforma',
    passos: [
      'Procura uma secção chamada iCal, Sincronização de calendários ou Importar calendário.',
      'Cola o endereço do Anfitrião no campo de importação.',
    ],
    notas: [
      'Com um gestor de canais, exportar daqui para lá raramente é preciso: é ele que manda nas plataformas todas e o calendário dele já é a fonte de verdade.',
    ],
  },
}

/**
 * Gestores de canais que o Anfitrião aceita como fonte. Estão à parte das OTA
 * porque mudam a topologia: quem usa um deles importa **dele**, e não de cada
 * plataforma — as reservas do Airbnb e do Booking já vêm lá dentro.
 */
export const GUIA_AMENITIZ: GuiaIcal = {
  label: 'Amenitiz (gestor de canais)',
  passos: [
    'Entra no Amenitiz.',
    'Abre Channel Manager → iCals.',
    'Procura o quarto na lista e carrega em Copiar, ao lado do endereço iCal dele.',
    'Repete para cada quarto — o Amenitiz dá um endereço por quarto, não um pela casa toda.',
  ],
  exemploUrl: 'https://…amenitiz…/ical/…ics',
  notas: [
    'Um endereço por quarto. Ligar a casa-mãe não traz as reservas dos quartos.',
    'A sincronização do Amenitiz é de sentido único: traz para cá o que ele sabe, mas nada do que fizeres aqui volta para lá.',
  ],
}

/**
 * O erro mais caro de quem tem gestor de canais: ligar o Amenitiz **e** o
 * Airbnb ao mesmo quarto. A mesma reserva chega por dois caminhos com
 * identificadores diferentes, e a deduplicação por UID não a apanha — fica
 * duplicada no calendário e a ocupação passa dos 100 %.
 */
export const AVISO_FONTE_DUPLICADA =
  'Já tens um gestor de canais ligado a este alojamento. Não acrescentes também o Airbnb ou o Booking: essas reservas já vêm no feed do gestor e ficariam duplicadas.'

/** Fontes que representam um gestor de canais e não uma OTA. */
const GESTORES_DE_CANAIS = ['amenitiz', 'smoobu', 'lodgify', 'beds24']

export function eGestorDeCanais(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return GESTORES_DE_CANAIS.some(g => host.includes(g))
  } catch {
    return false
  }
}

/** OTA cujas reservas um gestor de canais já traz — as que não se devem duplicar. */
const FONTES_OTA: BookingSource[] = ['airbnb', 'booking', 'expedia', 'vrbo']

/**
 * Deve avisar-se antes de acrescentar esta fonte?
 * Só quando já existe um gestor de canais e se está a acrescentar uma OTA.
 */
export function deveAvisarDuplicacao(
  urlsExistentes: string[],
  novaFonte: BookingSource,
): boolean {
  if (!FONTES_OTA.includes(novaFonte)) return false
  return urlsExistentes.some(eGestorDeCanais)
}
