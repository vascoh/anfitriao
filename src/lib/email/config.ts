// Configuração central de email — única fonte de verdade.
// Tudo vem de variáveis de ambiente; nunca hardcode emails fora deste ficheiro.

export const PLATFORM_NAME = 'Anfitriões'

// Endereço técnico de envio. Em produção TEM de ser um domínio verificado no
// Resend (ex.: noreply@anfitrioes.pt). O fallback sandbox só funciona em dev.
export const DEFAULT_FROM_EMAIL =
  process.env.EMAIL_FROM ??
  process.env.NOTIFY_FROM?.match(/<(.+)>/)?.[1] ?? // compat: NOTIFY_FROM antigo
  'onboarding@resend.dev'

export const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME ?? PLATFORM_NAME

export const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT ?? 'suporte@anfitrioes.pt'
export const SYSTEM_EMAIL = process.env.EMAIL_SYSTEM ?? DEFAULT_FROM_EMAIL

export const RESEND_API_KEY = process.env.RESEND_API_KEY

/** From dos emails da plataforma: "Anfitriões <noreply@anfitrioes.pt>" */
export function platformFrom(): string {
  return `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`
}

/**
 * From dos emails dos alojamentos: "Casa de Vasco via Anfitriões <noreply@...>".
 * O envio é SEMPRE pelo domínio da plataforma — o domínio do cliente nunca
 * entra no From (zero SPF/DKIM para clientes); vai apenas no Reply-To.
 */
export function propertyFrom(displayName: string): string {
  const clean = displayName.replace(/[<>"\r\n]/g, '').trim()
  if (!clean || clean === DEFAULT_FROM_NAME) return platformFrom()
  return `${clean} via ${PLATFORM_NAME} <${DEFAULT_FROM_EMAIL}>`
}
