import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { fetchIcalText, IcalFetchError } from '@/lib/ical-fetch'

/**
 * GET /api/ical-proxy?url=…
 * Proxy autenticado para pré-visualizar feeds iCal a partir do browser
 * (CORS impede o fetch direto). SSRF protegido em lib/ical-fetch.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const text = await fetchIcalText(url)
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  } catch (err) {
    if (err instanceof IcalFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 502 })
  }
}
