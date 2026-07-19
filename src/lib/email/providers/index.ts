import type { EmailProvider } from '../types'
import { RESEND_API_KEY } from '../config'
import { ResendProvider, NoopProvider } from './resend'

let provider: EmailProvider | null = null

/**
 * Provider ativo. Só Resend por agora; para adicionar SES/SendGrid/Mailgun,
 * implementa EmailProvider e seleciona aqui via EMAIL_PROVIDER.
 */
export function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = RESEND_API_KEY ? new ResendProvider(RESEND_API_KEY) : new NoopProvider()
  }
  return provider
}

/** Só para testes: injeta um provider fake. */
export function _setEmailProvider(p: EmailProvider | null): void {
  provider = p
}
