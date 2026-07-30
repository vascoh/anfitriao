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

/** Domínio de testes do Resend: só entrega ao dono da conta. Nunca serve produção. */
export const SANDBOX_FROM_EMAIL = 'onboarding@resend.dev'

export interface ProblemaEmail {
  nivel: 'erro' | 'aviso'
  mensagem: string
}

/**
 * Problemas de configuração de email, dos que calam o envio aos que o degradam.
 *
 * Existe porque a falha aqui é silenciosa por natureza: sem `RESEND_API_KEY` o
 * `NoopProvider` devolve `{ ok: false }` e ninguém olha para o resultado — em
 * produção estivemos semanas sem enviar um único email sem nada o denunciar
 * (ver PROGRESS.md, 2026-07-30). É lida no arranque do servidor
 * (`src/instrumentation.ts`), não no primeiro envio: um cron que não tem nada
 * para enviar nunca chegaria a instanciar o provider, e o silêncio parecia
 * normalidade.
 *
 * Função pura sobre o `env` que recebe, para ser testável sem mexer no processo.
 */
export function diagnosticarEmail(env: NodeJS.ProcessEnv = process.env): ProblemaEmail[] {
  // VERCEL_ENV distingue produção de preview; NODE_ENV diz "production" em ambos.
  const emProducao = env.VERCEL_ENV ? env.VERCEL_ENV === 'production' : env.NODE_ENV === 'production'
  const from = env.EMAIL_FROM ?? env.NOTIFY_FROM?.match(/<(.+)>/)?.[1] ?? SANDBOX_FROM_EMAIL

  if (!env.RESEND_API_KEY) {
    return [{
      nivel: emProducao ? 'erro' : 'aviso',
      mensagem: emProducao
        ? 'RESEND_API_KEY não está definida em produção: NENHUM email é enviado (NoopProvider engole tudo). Afeta pedidos e confirmações de reserva, check-in, lembretes de pagamento, fim de trial, alertas de conformidade, relatório mensal e o motor de automações.'
        : 'RESEND_API_KEY não definida — os emails não são enviados (NoopProvider). Normal em desenvolvimento e CI.',
    }]
  }

  if (from === SANDBOX_FROM_EMAIL && emProducao) {
    return [{
      nivel: 'erro',
      mensagem: `EMAIL_FROM não está definida em produção: os emails saem de ${SANDBOX_FROM_EMAIL}, o domínio de testes do Resend, que só entrega ao dono da conta. Definir um endereço num domínio verificado (ex.: noreply@anfitrioes.pt).`,
    }]
  }

  return []
}

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
