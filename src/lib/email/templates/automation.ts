import { escHtml } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import { renderEmail, themeFromIdentity, kicker, heading, paragraph } from './layout'

/** Hóspede: mensagem de uma automação (lembrete, código da porta, etc.), texto livre do anfitrião. */
export function automationMessageEmail(p: {
  identity: EmailIdentity
  subject: string
  mensagem: string
}): string {
  const theme = themeFromIdentity(p.identity)
  const bodyHtml = escHtml(p.mensagem).replace(/\n/g, '<br>')
  const body = `
    ${kicker(p.identity.displayName, theme)}
    ${heading(p.subject)}
    ${paragraph(bodyHtml)}
  `
  return renderEmail(theme, body)
}
