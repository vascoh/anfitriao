import * as Sentry from '@sentry/nextjs'
import { diagnosticarEmail } from '@/lib/email/config'

/**
 * Corre uma vez por arranque de servidor (cold start de cada instância, na
 * Vercel). Serve para denunciar configuração em falta que de outro modo só se
 * manifesta como silêncio — ver `diagnosticarEmail`.
 *
 * O Sentry só arranca com `SENTRY_DSN` definida: sem ela, `Sentry.init` nem é
 * chamado e `onRequestError` não envia nada. `sendDefaultPii: false` porque as
 * rotas tratam dados de boletim — nenhum corpo de pedido nem IP sai daqui.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
  }

  // O email só existe no runtime Node: a proxy corre em edge e não envia emails.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  for (const problema of diagnosticarEmail()) {
    const linha = `[arranque][email] ${problema.mensagem}`
    if (problema.nivel === 'erro') console.error(linha)
    else console.warn(linha)
  }
}

export const onRequestError = Sentry.captureRequestError
