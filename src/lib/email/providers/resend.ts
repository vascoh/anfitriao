import { Resend } from 'resend'
import type { EmailMessage, EmailProvider, SendResult } from '../types'

/**
 * `vasco@exemplo.pt` → `v***@exemplo.pt`. Os logs de runtime da Vercel não são
 * sítio para endereços de hóspedes; o domínio chega para perceber o que se perdeu.
 */
export function mascararEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/** Provider Resend — o único sítio do projeto que importa o SDK do Resend. */
export class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  private client: Resend

  constructor(apiKey: string) {
    this.client = new Resend(apiKey)
  }

  async send(msg: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: msg.from,
        to: msg.to,
        replyTo: msg.replyTo,
        subject: msg.subject,
        html: msg.html,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, id: data?.id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

/**
 * Sem API key (dev/CI): não envia, não falha. Deixa rasto de cada email
 * descartado — sem isto, um envio perdido é indistinguível de um envio bem
 * sucedido para quem lê os logs.
 */
export class NoopProvider implements EmailProvider {
  readonly name = 'noop'
  async send(msg: EmailMessage): Promise<SendResult> {
    console.warn(`[email][noop] descartado: "${msg.subject}" para ${mascararEmail(msg.to)} (RESEND_API_KEY em falta)`)
    return { ok: false, error: 'no_api_key' }
  }
}
