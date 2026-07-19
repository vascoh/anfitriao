import { escHtml, fmtDate, fmtMoney } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import { renderEmail, themeFromIdentity, kicker, heading, paragraph, detailsTable, hostFooter } from './layout'

/** Hóspede: lembrete de pagamento em falta antes do check-in. */
export function paymentReminderEmail(p: {
  identity: EmailIdentity
  guestName: string
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  total: number
  pago: number
  saldo: number
}): string {
  const theme = themeFromIdentity(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker('Lembrete automático', theme)}
    ${heading('Pagamento pendente')}
    ${paragraph(`Olá ${escHtml(firstName)}, o teu check-in em <strong>${escHtml(p.propertyName)}</strong> é daqui a poucos dias. Existe ainda um valor em aberto.`)}
    ${detailsTable([
      ['Check-in', fmtDate(p.checkIn)],
      ['Check-out', fmtDate(p.checkOut)],
      ['Noites', String(p.numNights)],
      ['Total reserva', fmtMoney(p.total)],
      ['Já pago', fmtMoney(p.pago)],
      ['Valor em falta', fmtMoney(p.saldo)],
    ], theme, { title: p.propertyName, highlightLast: true })}
    ${paragraph('Por favor entra em contacto para combinar o pagamento antes da chegada. Podes responder diretamente a este email.')}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme)}
  `)
}
