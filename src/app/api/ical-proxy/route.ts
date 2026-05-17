import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Anfitriao/1.0 Calendar Sync',
        Accept: 'text/calendar,*/*',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const text = await res.text()
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 502 })
  }
}
