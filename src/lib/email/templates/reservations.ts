import { escHtml, fmtDate, fmtMoney } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import {
  renderEmail, themeFromIdentity, kicker, heading, paragraph,
  detailsTable, noteBox, ctaButton, finePrint, hostFooter,
} from './layout'

export interface StayDetails {
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  numHospedes: number
  total: number
}

function stayRows(s: StayDetails): Array<[string, string]> {
  return [
    ['Check-in', fmtDate(s.checkIn)],
    ['Check-out', fmtDate(s.checkOut)],
    ['Noites', String(s.numNights)],
    ['Hóspedes', String(s.numHospedes)],
    ['Total', fmtMoney(s.total)],
  ]
}

/** Hóspede: pedido de reserva recebido (aguarda confirmação do anfitrião). */
export function reservationRequestEmail(p: StayDetails & {
  identity: EmailIdentity
  guestName: string
  notas: string | null
}): string {
  const theme = themeFromIdentity(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker('Pedido de reserva', theme)}
    ${heading('Recebemos o teu pedido!')}
    ${paragraph(`Olá ${escHtml(firstName)}, o teu pedido de reserva em <strong>${escHtml(p.propertyName)}</strong> foi recebido com sucesso. O anfitrião irá confirmar em breve.`)}
    ${detailsTable(stayRows(p), theme, { title: p.propertyName, highlightLast: true })}
    ${p.notas ? noteBox('As tuas notas', p.notas, theme) : ''}
    ${paragraph('O anfitrião irá confirmar a reserva e combinar o pagamento diretamente contigo. Podes responder a este email para falar com ele.')}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme)}
  `)
}

/** Hóspede: reserva confirmada, com link para check-in online. */
export function reservationConfirmedEmail(p: StayDetails & {
  identity: EmailIdentity
  guestName: string
  checkinLink: string
  instrucoes?: string | null
}): string {
  const theme = themeFromIdentity(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker('Reserva confirmada ✓', theme)}
    ${heading('A tua estadia está confirmada!')}
    ${paragraph(`Olá ${escHtml(firstName)}, a tua reserva em <strong>${escHtml(p.propertyName)}</strong> foi confirmada. Estamos a aguardar a tua chegada!`)}
    ${detailsTable(stayRows(p), theme, { title: p.propertyName, highlightLast: true })}
    ${p.instrucoes ? noteBox('Instruções de check-in', p.instrucoes, theme) : ''}
    ${ctaButton('Fazer check-in online →', p.checkinLink, theme)}
    ${finePrint('Demora menos de 1 minuto. Obrigatório por lei (SIBA/SEF).', theme)}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme)}
  `)
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
