import 'server-only'

// Allowlist of domains from which iCal feeds are accepted.
// Prevents SSRF attacks where an attacker supplies an internal URL
// (e.g. http://169.254.169.254/latest/meta-data/ on cloud VMs).
const ALLOWED_HOSTNAMES = [
  'airbnb.com',
  'airbnb.co.uk',
  'booking.com',
  'admin.booking.com',
  'vrbo.com',
  'homeaway.com',
  'expedia.com',
  'tripadvisor.com',
  'google.com',
  'calendar.google.com',
  'outlook.live.com',
  'outlook.office365.com',
]

const MAX_FEED_BYTES = 5 * 1024 * 1024 // 5 MB
const FETCH_TIMEOUT_MS = 15_000

export function isAllowedIcalUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    return ALLOWED_HOSTNAMES.some(
      allowed => hostname === allowed || hostname === `www.${allowed}` || hostname.endsWith(`.${allowed}`),
    )
  } catch {
    return false
  }
}

export class IcalFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'IcalFetchError'
  }
}

/**
 * Fetch an iCal feed with SSRF protection: HTTPS-only allowlisted hosts,
 * redirect destinations re-validated, 15s timeout, 5MB size cap.
 */
export async function fetchIcalText(url: string): Promise<string> {
  if (!isAllowedIcalUrl(url)) {
    throw new IcalFetchError('URL não permitido. Apenas feeds HTTPS de plataformas suportadas.', 403)
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Anfitriao/1.0 Calendar Sync',
      Accept: 'text/calendar,*/*',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  })

  // fetch follows redirects — re-validate where we actually landed
  if (res.url && !isAllowedIcalUrl(res.url)) {
    throw new IcalFetchError('Redirect para domínio não permitido.', 403)
  }

  if (!res.ok) {
    throw new IcalFetchError(`Upstream devolveu ${res.status}`, 502)
  }

  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (contentLength > MAX_FEED_BYTES) {
    throw new IcalFetchError('Feed demasiado grande.', 502)
  }

  const text = await res.text()
  if (text.length > MAX_FEED_BYTES) {
    throw new IcalFetchError('Feed demasiado grande.', 502)
  }
  return text
}
