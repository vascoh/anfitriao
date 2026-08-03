import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

/** Estado da base simulada, reposto em cada teste. */
let casa: Record<string, unknown> | null = null
let quartos: Array<Record<string, unknown>> = []
let conflitos: Array<{ propriedade_id: string }> = []
const inseridos: Array<{ table: string; rows: unknown }> = []
const apagados: string[] = []
let falhaInsertBookings = false

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'properties') {
          return {
            // Casa: .eq('id').single()
            eq: (coluna: string) => {
              if (coluna === 'id') {
                return {
                  single: async () =>
                    casa ? { data: casa, error: null } : { data: null, error: { message: 'not found' } },
                }
              }
              // Quartos: .eq('parent_id').eq('ativo')
              return { eq: async () => ({ data: quartos, error: null }) }
            },
          }
        }
        // bookings — conflitos em vários quartos
        return {
          in: () => ({
            not: () => ({
              lt: () => ({
                gt: async () => ({ data: conflitos, error: null }),
              }),
            }),
          }),
        }
      },
      insert: async (rows: unknown) => {
        if (table === 'bookings' && falhaInsertBookings) {
          return { error: { message: 'falhou' } }
        }
        inseridos.push({ table, rows })
        return { error: null }
      },
      delete: () => ({
        eq: (_c: string, val: string) => ({
          eq: async () => {
            apagados.push(val)
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

const notificacoes: unknown[] = []
vi.mock('@/lib/notify-booking', () => ({
  sendBookingNotification: async (args: unknown) => { notificacoes.push(args) },
}))

const { POST } = await import('./route')

const CASA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function propriedade(id: string, nome: string, capacidade: number, parent: string | null) {
  return {
    id, nome, capacidade, parent_id: parent, ativo: true, owner_id: 'user_1',
    preco_base: 100, cidade: 'Amora', tipo: parent ? 'quarto' : 'moradia',
  }
}

/** A Casa de Vasco: 5 + 2 + 1 = 8. */
function casaDeVasco() {
  casa = propriedade(CASA_ID, 'Casa de Vasco', 8, null)
  quartos = [
    propriedade('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Quarto Familiar', 5, CASA_ID),
    propriedade('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Quarto de Casal', 2, CASA_ID),
    propriedade('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Quarto Individual', 1, CASA_ID),
  ]
}

function pedido(corpo: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/book/grupo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}` },
    body: JSON.stringify(corpo),
  })
}

function corpoValido(extra?: { pessoas?: number }) {
  return {
    guest: { nome: 'Maria Silva', email: 'maria@exemplo.pt', telefone: '912345678' },
    booking: {
      propriedade_id: CASA_ID,
      check_in: addDays(today(), 10),
      check_out: addDays(today(), 14),
      num_hospedes: extra?.pessoas ?? 8,
    },
  }
}

describe('POST /api/book/grupo', () => {
  beforeEach(() => {
    casaDeVasco()
    conflitos = []
    inseridos.length = 0
    apagados.length = 0
    notificacoes.length = 0
    falhaInsertBookings = false
  })

  it('aceita o grupo de 8 e cria uma reserva por quarto', async () => {
    const res = await POST(pedido(corpoValido()))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.reservas).toBe(3)

    const bookings = inseridos.find(i => i.table === 'bookings')!.rows as Array<Record<string, unknown>>
    expect(bookings).toHaveLength(3)
    // Todas ligadas pelo mesmo grupo, e todas do mesmo hóspede.
    expect(new Set(bookings.map(b => b.reserva_grupo_id)).size).toBe(1)
    expect(new Set(bookings.map(b => b.hospede_id)).size).toBe(1)
  })

  it('distribui as 8 pessoas pelos quartos, dos maiores para os menores', async () => {
    await POST(pedido(corpoValido()))
    const bookings = inseridos.find(i => i.table === 'bookings')!.rows as Array<Record<string, unknown>>
    expect(bookings.map(b => b.num_hospedes)).toEqual([5, 2, 1])
    expect(bookings.reduce((s, b) => s + (b.num_hospedes as number), 0)).toBe(8)
  })

  it('as reservas ficam pendentes — o anfitrião é que confirma', async () => {
    await POST(pedido(corpoValido()))
    const bookings = inseridos.find(i => i.table === 'bookings')!.rows as Array<Record<string, unknown>>
    expect(bookings.every(b => b.estado === 'pendente')).toBe(true)
    expect(bookings.every(b => b.preco_pago === 0)).toBe(true)
  })

  it('recusa 9 pessoas, porque a casa leva 8', async () => {
    const res = await POST(pedido(corpoValido({ pessoas: 9 })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('8')
    expect(inseridos).toHaveLength(0)
  })

  it('recusa quando um dos quartos já está ocupado — meia casa não é a casa', async () => {
    conflitos = [{ propriedade_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]
    const res = await POST(pedido(corpoValido()))
    expect(res.status).toBe(409)
    expect(inseridos).toHaveLength(0)
  })

  it('envia uma notificação ao anfitrião, não uma por quarto', async () => {
    await POST(pedido(corpoValido()))
    expect(notificacoes).toHaveLength(1)
  })

  it('não deixa o hóspede órfão se as reservas falharem', async () => {
    falhaInsertBookings = true
    const res = await POST(pedido(corpoValido()))
    expect(res.status).toBe(500)
    expect(apagados).toHaveLength(1)
  })

  it('recusa datas no passado', async () => {
    const corpo = corpoValido()
    corpo.booking.check_in = addDays(today(), -3)
    corpo.booking.check_out = addDays(today(), 2)
    const res = await POST(pedido(corpo))
    expect(res.status).toBe(400)
  })

  it('recusa email inválido', async () => {
    const corpo = corpoValido()
    corpo.guest.email = 'não-é-email'
    expect((await POST(pedido(corpo))).status).toBe(400)
  })

  it('recusa uma casa sem quartos', async () => {
    quartos = []
    const res = await POST(pedido(corpoValido({ pessoas: 2 })))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('quartos')
  })

  it('recusa um alojamento que não existe', async () => {
    casa = null
    expect((await POST(pedido(corpoValido()))).status).toBe(404)
  })

  it('o preço vem do servidor, não do que o cliente mandar', async () => {
    const corpo = corpoValido() as Record<string, Record<string, unknown>>
    corpo.booking.preco_total = 1
    await POST(pedido(corpo))
    const bookings = inseridos.find(i => i.table === 'bookings')!.rows as Array<Record<string, unknown>>
    // 3 quartos × 4 noites a preco_base 100 = 400 cada.
    expect(bookings.every(b => (b.preco_total as number) > 1)).toBe(true)
  })
})
