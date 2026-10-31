import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * Dois segredos aceites:
 * - `CRON_SECRET` — o que a Vercel manda nos crons do `vercel.json`.
 * - `CRON_SECRET_EXTERNO` — o do agendador do Supabase (pg_cron + pg_net,
 *   migração 056), guardado no Vault. Separado de propósito: rodá-lo não mexe
 *   nos crons da Vercel, e o `CRON_SECRET` nunca sai da Vercel.
 */
function igual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function checkCronAuth(req: NextRequest): NextResponse | null {
  const segredos = [process.env.CRON_SECRET, process.env.CRON_SECRET_EXTERNO].filter((s): s is string => !!s)

  if (segredos.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron-auth] CRON_SECRET is not set in production — blocking request')
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 })
    }
    return null
  }

  const auth = req.headers.get('authorization') ?? ''
  if (!segredos.some(s => igual(auth, `Bearer ${s}`))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
