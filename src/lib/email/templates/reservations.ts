import { escHtml, fmtDate, fmtMoney } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import {
  renderEmail, themeFromIdentity, kicker, heading, paragraph,
  detailsTable, noteBox, ctaButton, finePrint, hostFooter,
} from './layout'
import { linguaDoEmail, dataEmail, tx, frases, type EmailLang } from './lingua'

export interface StayDetails {
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  numHospedes: number
  total: number
}

function stayRows(s: StayDetails, lang: EmailLang): Array<[string, string]> {
  return [
    [tx(lang, 'checkin'), dataEmail(s.checkIn, lang)],
    [tx(lang, 'checkout'), dataEmail(s.checkOut, lang)],
    [tx(lang, 'noites'), String(s.numNights)],
    [tx(lang, 'hospedes'), String(s.numHospedes)],
    [tx(lang, 'total'), fmtMoney(s.total)],
  ]
}

/** Hóspede: pedido de reserva recebido (aguarda confirmação do anfitrião). */
export function reservationRequestEmail(p: StayDetails & {
  identity: EmailIdentity
  guestName: string
  notas: string | null
}): string {
  const theme = themeFromIdentity(p.identity)
  const lang = linguaDoEmail(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker(tx(lang, 'pedido_kicker'), theme)}
    ${heading(tx(lang, 'pedido_titulo'))}
    ${paragraph(frases.pedidoOla(lang, escHtml(firstName), escHtml(p.propertyName)))}
    ${detailsTable(stayRows(p, lang), theme, { title: p.propertyName, highlightLast: true })}
    ${p.notas ? noteBox(tx(lang, 'pedido_notas'), p.notas, theme) : ''}
    ${paragraph(tx(lang, p.identity.replyTo ? 'pedido_resposta' : 'pedido_sem_resposta'))}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme, lang)}
  `, lang)
}

/** Hóspede: reserva confirmada, com link para check-in online. */
export function reservationConfirmedEmail(p: StayDetails & {
  identity: EmailIdentity
  guestName: string
  checkinLink: string
  instrucoes?: string | null
}): string {
  const theme = themeFromIdentity(p.identity)
  const lang = linguaDoEmail(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker(tx(lang, 'confirmada_kicker'), theme)}
    ${heading(tx(lang, 'confirmada_titulo'))}
    ${paragraph(frases.confirmadaOla(lang, escHtml(firstName), escHtml(p.propertyName)))}
    ${detailsTable(stayRows(p, lang), theme, { title: p.propertyName, highlightLast: true })}
    ${p.instrucoes ? noteBox(tx(lang, 'instrucoes'), p.instrucoes, theme) : ''}
    ${ctaButton(tx(lang, 'checkin_cta'), p.checkinLink, theme)}
    ${finePrint(tx(lang, 'checkin_nota'), theme)}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme, lang)}
  `, lang)
}

/** Anfitrião: nova reserva pendente no painel. */
export function ownerNewBookingEmail(p: StayDetails & {
  identity: EmailIdentity
  bookingId: string
  guestName: string
  guestEmail: string
  guestPhone: string | null
  notas: string | null
  baseUrl: string
}): string {
  const theme = themeFromIdentity(p.identity)
  return renderEmail(theme, `
    ${kicker('Nova reserva pendente', theme)}
    ${heading(p.propertyName)}
    ${detailsTable([
      ['Check-in', fmtDate(p.checkIn)],
      ['Check-out', fmtDate(p.checkOut)],
      ['Noites', String(p.numNights)],
      ['Hóspedes', String(p.numHospedes)],
      ['Total estimado', fmtMoney(p.total)],
    ], theme, { highlightLast: true })}
    ${kicker('Hóspede', theme)}
    ${paragraph(`<strong style="color:#1a1209;">${escHtml(p.guestName)}</strong><br>${escHtml(p.guestEmail)}${p.guestPhone ? `<br>${escHtml(p.guestPhone)}` : ''}`)}
    ${p.notas ? noteBox('Notas do hóspede', p.notas, theme) : ''}
    ${ctaButton('Ver reserva no painel →', `${p.baseUrl}/reservas/${p.bookingId}`, theme)}
  `)
}
