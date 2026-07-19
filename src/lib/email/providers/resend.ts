import { Resend } from 'resend'
import type { EmailMessage, EmailProvider, SendResult } from '../types'

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

/** Sem API key (dev/CI): não envia, não falha. */
export class NoopProvider implements EmailProvider {
  readonly name = 'noop'
  async send(): Promise<SendResult> {
    return { ok: false, error: 'no_api_key' }
  }
}
