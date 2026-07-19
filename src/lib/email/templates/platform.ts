import { escHtml } from '@/lib/utils'
import { renderEmail, platformTheme, kicker, heading, paragraph, ctaButton } from './layout'

/** Plataforma: trial a expirar (3 dias / 1 dia). */
export function trialEndingEmail(p: { firstName: string; daysLeft: number; trialDate: string; baseUrl: string }): string {
  const theme = platformTheme()
  const urgent = p.daysLeft === 1
  return renderEmail(theme, `
    ${kicker(urgent ? 'Último dia' : 'O teu trial está a acabar', theme)}
    ${heading(urgent ? 'O teu trial termina amanhã' : `Faltam ${p.daysLeft} dias de trial`)}
    ${paragraph(`Olá ${escHtml(p.firstName)}, o teu período experimental termina a <strong>${escHtml(p.trialDate)}</strong>. Para continuares a usar o calendário, o check-in online e o SIBA automático sem interrupções, ativa a tua subscrição.`)}
    ${ctaButton('Ativar subscrição →', `${p.baseUrl}/conta/billing`, theme)}
    ${paragraph('Se precisares de ajuda ou tiveres questões, basta responder a este email.')}
  `)
}

/** Plataforma: trial expirou hoje. */
export function trialExpiredEmail(p: { firstName: string; baseUrl: string }): string {
  const theme = platformTheme()
  return renderEmail(theme, `
    ${kicker('Trial terminado', theme)}
    ${heading('O teu trial expirou hoje')}
    ${paragraph(`Olá ${escHtml(p.firstName)}, o teu período experimental chegou ao fim. Os teus dados estão guardados — ativa a subscrição para voltares a ter acesso ao painel.`)}
    ${ctaButton('Reativar conta →', `${p.baseUrl}/conta/billing`, theme)}
  `)
}
