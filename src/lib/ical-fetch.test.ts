import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { isAllowedIcalUrl } = await import('./ical-fetch')

describe('isAllowedIcalUrl', () => {
  it('accepts HTTPS feeds from supported platforms', () => {
    expect(isAllowedIcalUrl('https://www.airbnb.com/calendar/ical/123.ics?s=abc')).toBe(true)
    expect(isAllowedIcalUrl('https://admin.booking.com/hotel/ical.ics')).toBe(true)
    expect(isAllowedIcalUrl('https://calendar.google.com/calendar/ical/x/basic.ics')).toBe(true)
    expect(isAllowedIcalUrl('https://ical.booking.com/v1/export?t=x')).toBe(true) // subdomain
  })

  it('rejects plain HTTP', () => {
    expect(isAllowedIcalUrl('http://www.airbnb.com/calendar/ical/123.ics')).toBe(false)
  })

  it('rejects internal/metadata addresses (SSRF)', () => {
    expect(isAllowedIcalUrl('https://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isAllowedIcalUrl('https://localhost/admin')).toBe(false)
    expect(isAllowedIcalUrl('https://10.0.0.1/x')).toBe(false)
  })

  it('rejects lookalike domains', () => {
    expect(isAllowedIcalUrl('https://airbnb.com.evil.io/x.ics')).toBe(false)
    expect(isAllowedIcalUrl('https://evilairbnb.com/x.ics')).toBe(false)
    expect(isAllowedIcalUrl('https://airbnb.com@evil.io/x.ics')).toBe(false)
  })

  it('rejects garbage input', () => {
    expect(isAllowedIcalUrl('')).toBe(false)
    expect(isAllowedIcalUrl('not a url')).toBe(false)
    expect(isAllowedIcalUrl('file:///etc/passwd')).toBe(false)
  })
})
