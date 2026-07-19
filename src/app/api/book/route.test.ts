import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

const inserted: { table: string; row: Record<string, unknown> }[] = []
const deleted: string[] = []
let propertyRow: Record<string, unknown> | null = null
let conflictRows: Array<{ id: string }> = []

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'properties') {
          return {
            eq: () => ({
              single: async () =>
                propertyRow
                  ? { data: propertyRow, error: null }
                  : { data: null, error: { message: 'not found' } },
            }),
          }
        }
        // bookings — verificação de conflito de datas
        return {
          eq: () => ({
            not: () => ({
              lt: () => ({
                gt: () => ({
                  limit: async () => ({ data: conflictRows, error: null }),
                }),
              }),
            }),
          }),
        }
      },
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, row })
        return { error: null }
      },
      delete: () => ({
        eq: (_col: string, val: string) => ({
          eq: async () => {
            deleted.push(val)
            return { error: null }
          },
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/db-admin', () => ({
  adminGetPriceRules: async () => [],
  adminGetTarifas: async () => [],
  adminGetPlatformRates: async () => [],
}))

let rateLimited = false
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: !rateLimited, remaining: 0, resetAt: 0 }),
  getClientIp: () => '1.2.3.4',
}))

const notifyMock = vi.fn(async (..._args: unknown[]) => {})
vi.mock('@/lib/notify-booking', () => ({
  sendBookingNotification: (...args: unknown[]) => notifyMock(...args),
}))

const { POST } = await import('./route')

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/book', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

// Datas dinâmicas: a suite tem de passar em qualquer data/timezone
const CHECK_IN = addDays(today(), 30)
const CHECK_OUT = addDays(today(), 32)

const VALID = {
  guest: { nome: 'João Silva', email: 'joao@example.com', telefone: '+351911111111' },
  booking: {
    propriedade_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    check_in: CHECK_IN,
    check_out: CHECK_OUT,
    num_hospedes: 2,
  },
}

const PROPERTY = { id: 'prop-1', owner_id: 'owner-1', nome: 'Casa do Mar', preco_base: 100, taxa_limpeza: 0, ativo: true }

beforeEach(() => {
  inserted.length = 0
  deleted.length = 0
  notifyMock.mockClear()
  propertyRow = { ...PROPERTY }
  conflictRows = []
  rateLimited = false
})

describe('POST /api/book', () => {
  it('creates guest and booking, derives owner from property', async () => {
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    expect(inserted.map(i => i.table)).toEqual(['guests', 'bookings'])
    const booking = inserted[1].row
    expect(booking.owner_id).toBe('owner-1')
    expect(booking.estado).toBe('pendente')
    expect(booking.origem).toBe('direto')
    expect(booking.preco_pago).toBe(0)
    expect(notifyMock).toHaveBeenCalledOnce()
  })

  it('ignores client-supplied estado/origem/owner_id (anti mass-assignment)', async () => {
    const res = await POST(makeReq({
      guest: VALID.guest,
      booking: { ...VALID.booking, estado: 'confirmada', origem: 'airbnb', owner_id: 'attacker' },
    }))
    expect(res.status).toBe(200)
    const booking = inserted[1].row
    expect(booking.estado).toBe('pendente')
    expect(booking.origem).toBe('direto')
    expect(booking.owner_id).toBe('owner-1')
  })

  it('computes the price server-side, ignoring the client value', async () => {
    const res = await POST(makeReq({
      guest: VALID.guest,
      booking: { ...VALID.booking, preco_total: 1 },
    }))
    expect(res.status).toBe(200)
    // 2 noites × 100€ (preco_base), sem regras/tarifas
    expect(inserted[1].row.preco_total).toBe(200)
  })

  it('rejects invalid JSON', async () => {
    const res = await POST(makeReq('{not json'))
    expect(res.status).toBe(400)
  })

  it('rejects missing guest name', async () => {
    const res = await POST(makeReq({ ...VALID, guest: { ...VALID.guest, nome: '  ' } }))
    expect(res.status).toBe(400)
  })

  it('rejects invalid email', async () => {
    const res = await POST(makeReq({ ...VALID, guest: { ...VALID.guest, email: 'not-an-email' } }))
    expect(res.status).toBe(400)
  })

  it('rejects invalid, inverted or past dates', async () => {
    for (const dates of [
      { check_in: '10-09-2026', check_out: CHECK_OUT },
      { check_in: CHECK_OUT, check_out: CHECK_IN },
      { check_in: CHECK_IN, check_out: CHECK_IN },
      { check_in: addDays(today(), -2), check_out: addDays(today(), 1) },
      { check_in: CHECK_IN, check_out: addDays(CHECK_IN, 400) },
    ]) {
      const res = await POST(makeReq({ ...VALID, booking: { ...VALID.booking, ...dates } }))
      expect(res.status).toBe(400)
    }
  })

  it('rejects out-of-range guest count', async () => {
    for (const patch of [{ num_hospedes: 0 }, { num_hospedes: 51 }, { num_hospedes: 2.5 }]) {
      const res = await POST(makeReq({ ...VALID, booking: { ...VALID.booking, ...patch } }))
      expect(res.status).toBe(400)
    }
  })

  it('returns 404 when the property does not exist', async () => {
    propertyRow = null
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(404)
    expect(inserted).toHaveLength(0)
  })

  it('returns 404 when the property is inactive', async () => {
    propertyRow = { ...PROPERTY, ativo: false }
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(404)
    expect(inserted).toHaveLength(0)
  })

  it('returns 409 when the dates are no longer available', async () => {
    conflictRows = [{ id: 'existing-booking' }]
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(409)
    expect(inserted).toHaveLength(0)
  })

  it('returns 429 when rate limited', async () => {
    rateLimited = true
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(429)
    expect(inserted).toHaveLength(0)
  })

  it('rejects malicious propriedade_id', async () => {
    const res = await POST(makeReq({
      ...VALID,
      booking: { ...VALID.booking, propriedade_id: "1'; DROP TABLE bookings;--" },
    }))
    expect(res.status).toBe(400)
  })

  it('truncates oversized notes and phone instead of failing', async () => {
    const res = await POST(makeReq({
      guest: { ...VALID.guest, telefone: 'x'.repeat(500) },
      booking: { ...VALID.booking, notas: 'y'.repeat(5000) },
    }))
    expect(res.status).toBe(200)
    expect((inserted[0].row.telefone as string).length).toBe(40)
    expect((inserted[1].row.notas as string).length).toBe(2000)
  })

  it('succeeds even if the email notification throws', async () => {
    notifyMock.mockRejectedValueOnce(new Error('resend down'))
    const res = await POST(makeReq(VALID))
    expect(res.status).toBe(200)
  })
})
