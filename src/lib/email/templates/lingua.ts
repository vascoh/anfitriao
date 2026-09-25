import { parseDate } from '@/lib/utils'
import type { EmailIdentity } from '../types'

/**
 * Língua dos emails ao **hóspede**.
 *
 * É a do site do anfitrião (`website_settings.idioma`, que chega aqui como
 * `identity.language`): foi nessa língua que o hóspede fez o pedido, e é
 * nessa que espera a resposta. Os emails ao anfitrião ficam em português —
 * o cliente do Anfitrião é português, o hóspede não tem de ser.
 */
export type EmailLang = 'pt' | 'en'

export function linguaDoEmail(identity: Pick<EmailIdentity, 'language'>): EmailLang {
  return identity.language === 'en' ? 'en' : 'pt'
}

/** Data curta na língua do email: «12 set.» / «12 Sept». */
export function dataEmail(iso: string, lang: EmailLang): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'short' })
    .format(parseDate(iso))
}

const T = {
  checkin: { pt: 'Check-in', en: 'Check-in' },
  checkout: { pt: 'Check-out', en: 'Check-out' },
  noites: { pt: 'Noites', en: 'Nights' },
  hospedes: { pt: 'Hóspedes', en: 'Guests' },
  total: { pt: 'Total', en: 'Total' },
  anfitriao: { pt: 'Anfitrião', en: 'Host' },
  contacto: { pt: 'Contacto', en: 'Contact' },
  // pedido
  pedido_kicker: { pt: 'Pedido de reserva', en: 'Booking request' },
  pedido_titulo: { pt: 'Recebemos o teu pedido!', en: 'We have received your request!' },
  pedido_notas: { pt: 'As tuas notas', en: 'Your notes' },
  pedido_resposta: {
    pt: 'O anfitrião irá confirmar a reserva e combinar o pagamento diretamente contigo. Podes responder a este email para falar com ele.',
    en: 'The host will confirm the booking and arrange payment directly with you. You can reply to this email to reach them.',
  },
  pedido_sem_resposta: {
    pt: 'O anfitrião irá confirmar a reserva e combinar o pagamento diretamente contigo.',
    en: 'The host will confirm the booking and arrange payment directly with you.',
  },
  // confirmação
  confirmada_kicker: { pt: 'Reserva confirmada ✓', en: 'Booking confirmed ✓' },
  confirmada_titulo: { pt: 'A tua estadia está confirmada!', en: 'Your stay is confirmed!' },
  instrucoes: { pt: 'Instruções de check-in', en: 'Check-in instructions' },
  checkin_cta: { pt: 'Fazer check-in online →', en: 'Check in online →' },
  checkin_nota: {
    pt: 'Demora menos de 1 minuto. Obrigatório por lei (boletim de alojamento, SIBA/AIMA).',
    en: 'It takes less than a minute. Required by Portuguese law (guest registration with SIBA/AIMA).',
  },
  // pagamento
  pagamento_kicker: { pt: 'Lembrete automático', en: 'Automatic reminder' },
  pagamento_titulo: { pt: 'Pagamento pendente', en: 'Payment due' },
  total_reserva: { pt: 'Total reserva', en: 'Booking total' },
  ja_pago: { pt: 'Já pago', en: 'Already paid' },
  em_falta: { pt: 'Valor em falta', en: 'Amount due' },
  pagamento_resposta: {
    pt: 'Por favor entra em contacto para combinar o pagamento antes da chegada. Podes responder diretamente a este email.',
    en: 'Please get in touch to arrange payment before you arrive. You can reply directly to this email.',
  },
  pagamento_sem_resposta: {
    pt: 'Por favor entra em contacto com o anfitrião para combinar o pagamento antes da chegada.',
    en: 'Please contact the host to arrange payment before you arrive.',
  },
} as const

export function tx(lang: EmailLang, chave: keyof typeof T): string {
  return T[chave][lang]
}

/** Frases com dados — o HTML dos nomes já vem escapado por quem chama. */
export const frases = {
  pedidoOla: (lang: EmailLang, nome: string, alojamento: string) => lang === 'en'
    ? `Hi ${nome}, your booking request at <strong>${alojamento}</strong> has been received. The host will confirm it shortly.`
    : `Olá ${nome}, o teu pedido de reserva em <strong>${alojamento}</strong> foi recebido com sucesso. O anfitrião irá confirmar em breve.`,
  confirmadaOla: (lang: EmailLang, nome: string, alojamento: string) => lang === 'en'
    ? `Hi ${nome}, your booking at <strong>${alojamento}</strong> is confirmed. We look forward to welcoming you!`
    : `Olá ${nome}, a tua reserva em <strong>${alojamento}</strong> foi confirmada. Estamos a aguardar a tua chegada!`,
  pagamentoOla: (lang: EmailLang, nome: string, alojamento: string) => lang === 'en'
    ? `Hi ${nome}, your check-in at <strong>${alojamento}</strong> is only a few days away, and there is still an amount outstanding.`
    : `Olá ${nome}, o teu check-in em <strong>${alojamento}</strong> é daqui a poucos dias. Existe ainda um valor em aberto.`,
}

export const assuntos = {
  pedido: (lang: EmailLang, alojamento: string) =>
    lang === 'en' ? `Booking request received — ${alojamento}` : `Pedido de reserva recebido — ${alojamento}`,
  confirmada: (lang: EmailLang, alojamento: string) =>
    lang === 'en' ? `Booking confirmed — ${alojamento}` : `Reserva confirmada — ${alojamento}`,
  pagamento: (lang: EmailLang, alojamento: string, checkIn: string) =>
    lang === 'en'
      ? `Payment due — ${alojamento} · ${dataEmail(checkIn, lang)}`
      : `Pagamento pendente — ${alojamento} · ${dataEmail(checkIn, lang)}`,
}
