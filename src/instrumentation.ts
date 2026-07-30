import { diagnosticarEmail } from '@/lib/email/config'

/**
 * Corre uma vez por arranque de servidor (cold start de cada instância, na
 * Vercel). Serve para denunciar configuração em falta que de outro modo só se
 * manifesta como silêncio — ver `diagnosticarEmail`.
 *
 * Só no runtime Node: a proxy corre em edge e não envia emails.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  for (const problema of diagnosticarEmail()) {
    const linha = `[arranque][email] ${problema.mensagem}`
    if (problema.nivel === 'erro') console.error(linha)
    else console.warn(linha)
  }
}
