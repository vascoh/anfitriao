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

// ─── Receção (caixa de entrada) ────────────────────────────────────────────

export interface EmailRecebido {
  id: string
  from: string
  to: string[]
  subject: string
  text: string | null
  html: string | null
  messageId: string | null
}

/**
 * Valida a assinatura (Svix) de um webhook do Resend e devolve o evento de
 * email recebido — ou null se a assinatura não bate ou o evento é outro.
 */
export function verificarEmailRecebido(
  corpo: string,
  cabecalhos: { id: string | null; timestamp: string | null; signature: string | null },
): { email_id: string; from: string; to: string[]; subject: string } | null {
  const segredo = process.env.RESEND_WEBHOOK_SECRET
  if (!segredo || !cabecalhos.id || !cabecalhos.timestamp || !cabecalhos.signature) return null
  try {
    // A verificação é local (Svix); a chave só existe para o construtor não recusar.
    const evento = new Resend(process.env.RESEND_API_KEY ?? 're_verificacao_local').webhooks.verify({
      payload: corpo,
      headers: { id: cabecalhos.id, timestamp: cabecalhos.timestamp, signature: cabecalhos.signature },
      webhookSecret: segredo,
    })
    return evento.type === 'email.received' ? evento.data : null
  } catch {
    return null
  }
}

/** O webhook só traz metadados; o corpo lê-se à parte. */
export async function lerEmailRecebido(id: string): Promise<EmailRecebido | null> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) return null
  const { data, error } = await new Resend(chave).emails.receiving.get(id)
  if (error || !data) {
    console.error('[email][rececao] não foi possível ler o email', id, error?.message)
    return null
  }
  return {
    id: data.id,
    from: data.from,
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
    messageId: data.message_id ?? null,
  }
}
