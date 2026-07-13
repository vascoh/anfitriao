import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp } from './rate-limit'

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows up to the limit and blocks beyond it', () => {
    const key = `t1-${crypto.randomUUID()}`
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    const fourth = checkRateLimit(key, 3, 60_000)
    expect(fourth.allowed).toBe(false)
    expect(fourth.remaining).toBe(0)
  })

  it('decrements remaining on each call', () => {
    const key = `t2-${crypto.randomUUID()}`
    expect(checkRateLimit(key, 5, 60_000).remaining).toBe(4)
    expect(checkRateLimit(key, 5, 60_000).remaining).toBe(3)
  })

  it('resets after the window expires', () => {
    vi.useFakeTimers()
    const key = `t3-${crypto.randomUUID()}`
    checkRateLimit(key, 1, 60_000)
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false)
    vi.advanceTimersByTime(60_001)
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const a = `t4a-${crypto.randomUUID()}`
    const b = `t4b-${crypto.randomUUID()}`
    checkRateLimit(a, 1, 60_000)
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true)
  })

  it('reports resetAt at the end of the window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const key = `t5-${crypto.randomUUID()}`
    const res = checkRateLimit(key, 2, 30_000)
    expect(res.resetAt).toBe(1_030_000)
  })
})

describe('getClientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://x', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('returns unknown when no headers present', () => {
    expect(getClientIp(new Request('http://x'))).toBe('unknown')
  })
})
