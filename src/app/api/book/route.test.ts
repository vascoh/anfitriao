import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const inserted: { table: string; row: Record<string, unknown> }[] = []
let propertyRow: { owner_id: string | null; nome: string } | null = { owner_id: 'owner-1', nome: 'Casa do Mar' }

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            propertyRow
              ? { data: propertyRow, error: null }
              : { data: null, error: { message: 'not found' } },
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, row })
        return { error: null }
      },
    }),
  }),
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

const VALID = {
  guest: { nome: 'João Silva', email: 'joao@example.com', telefone: '+351911111111' },
  booking: {
    propriedade_id: 'prop-1',
    check_in: '2026-09-10',
    check_out: '2026-09-12',
    num_hospedes: 2,
    preco_total: 200,
  },
}

beforeEach(() => {
  inserted.length = 0
  notifyMock.mockClear()
  propertyRow = { owner_id: 'owner-1', nome: 'Casa do Mar' }
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

  it('rejects invalid or inverted dates', async () => {
    for (const dates of [
      { check_in: '10-09-2026', check_out: '2026-09-12' },
      { check_in: '2026-09-12', check_out: '2026-09-10' },
      { check_in: '2026-09-10', check_out: '2026-09-10' },
    ]) {
      const res = await POST(makeReq({ ...VALID, booking: { ...VALID.booking, ...dates } }))
      expect(res.status).toBe(400)
    }
  })

  it('rejects out-of-range guest count and price', async () => {
    for (const patch of [{ num_hospedes: 0 }, { num_hospedes: 51 }, { num_hospedes: 2.5 }, { preco_total: -1 }, { preco_total: 200000 }]) {
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
