import { escHtml, fmtMoney } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import { linguaDoEmail, dataEmail, tx, frases } from './lingua'
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
  const lang = linguaDoEmail(p.identity)
  const firstName = p.guestName.split(' ')[0]
  return renderEmail(theme, `
    ${kicker(tx(lang, 'pagamento_kicker'), theme)}
    ${heading(tx(lang, 'pagamento_titulo'))}
    ${paragraph(frases.pagamentoOla(lang, escHtml(firstName), escHtml(p.propertyName)))}
    ${detailsTable([
      [tx(lang, 'checkin'), dataEmail(p.checkIn, lang)],
      [tx(lang, 'checkout'), dataEmail(p.checkOut, lang)],
      [tx(lang, 'noites'), String(p.numNights)],
      [tx(lang, 'total_reserva'), fmtMoney(p.total)],
      [tx(lang, 'ja_pago'), fmtMoney(p.pago)],
      [tx(lang, 'em_falta'), fmtMoney(p.saldo)],
    ], theme, { title: p.propertyName, highlightLast: true })}
    ${paragraph(tx(lang, p.identity.replyTo ? 'pagamento_resposta' : 'pagamento_sem_resposta'))}
    ${hostFooter(p.identity.displayName, p.identity.contact, theme, lang)}
  `, lang)
}
