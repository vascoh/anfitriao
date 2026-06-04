import { NextRequest, NextResponse } from 'next/server'

export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron-auth] CRON_SECRET is not set in production — blocking request')
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 })
    }
    return null
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
