import { NextRequest, NextResponse } from 'next/server'

// Allowlist of domains from which iCal feeds are accepted.
// Prevents SSRF attacks where an attacker supplies an internal URL
// (e.g. http://169.254.169.254/latest/meta-data/ on cloud VMs).
const ALLOWED_HOSTNAMES = new Set([
  'airbnb.com',
  'www.airbnb.com',
  'airbnb.co.uk',
  'www.airbnb.co.uk',
  'booking.com',
  'www.booking.com',
  'admin.booking.com',
  'vrbo.com',
  'www.vrbo.com',
  'homeaway.com',
  'www.homeaway.com',
  'expedia.com',
  'www.expedia.com',
  'tripadvisor.com',
  'www.tripadvisor.com',
  'google.com',
  'calendar.google.com',
  'outlook.live.com',
  'outlook.office365.com',
])

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    // exact match or subdomain of an allowed domain
    return (
      ALLOWED_HOSTNAMES.has(hostname) ||
      [...ALLOWED_HOSTNAMES].some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
      )
    )
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: 'URL not allowed. Only HTTPS calendar feeds from supported platforms are accepted.' },
      { status: 403 },
    )
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
