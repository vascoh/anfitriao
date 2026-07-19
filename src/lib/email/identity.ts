import 'server-only'
import { adminGetWebsiteSettings } from '@/lib/db-admin'
import { SUPPORT_EMAIL } from './config'
import type { EmailIdentity } from './types'
import type { WebsiteSettings } from '@/lib/types'

const DEFAULT_PRIMARY = '#C2714F'
const DEFAULT_SECONDARY = '#9a8070'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback
}

/** Constrói a EmailIdentity a partir do website_settings já carregado. */
export function identityFromSettings(settings: WebsiteSettings): EmailIdentity {
  const displayName = settings.nome || settings.host_nome || 'O teu alojamento'
  return {
    displayName,
    propertyName: displayName,
    replyTo: settings.email_reservas || settings.email || null,
    logoText: settings.logo_texto || displayName,
    primaryColor: safeColor(settings.cor_primaria, DEFAULT_PRIMARY),
    secondaryColor: safeColor(settings.cor_secundaria, DEFAULT_SECONDARY),
    signature: settings.assinatura_email || null,
    contact: settings.telefone || settings.email || '',
    supportEmail: SUPPORT_EMAIL,
    language: settings.idioma || 'pt',
  }
}

/** Identidade de email do alojamento de um anfitrião (1 query). */
export async function emailIdentityForOwner(ownerId: string | null | undefined): Promise<EmailIdentity> {
  const settings = await adminGetWebsiteSettings(ownerId)
  return identityFromSettings(settings)
}
