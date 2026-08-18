import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; dados: Record<string, unknown> }> = []

function construtor(tabela: string, update?: Record<string, unknown>) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    gte: (c: string, v: string) => { filtros.push(l => String(l[c]) >= v); return obj },
    lte: (c: string, v: string) => { filtros.push(l => String(l[c]) <= v); return obj },
    then: (r: (v: { data: unknown; error: null }) => unknown) => {
      if (update) {
        alvo().forEach(l => { escritas.push({ tabela, dados: update }); Object.assign(l, update) })
        return r({ data: null, error: null })
      }
      return r({ data: alvo(), error: null })
    },
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (t: string) => ({
      select: () => construtor(t),
      update: (d: Record<string, unknown>) => construtor(t, d),
    }),
  }),
}))

vi.mock('@/lib/cron-auth', () => ({ checkCronAuth: () => null }))

/** Emails efetivamente enviados a hóspedes. */
const emails: Array<Record<string, unknown>> = []
vi.mock('@/lib/email', () => ({
  emailService: {
    sendPaymentReminder: async (p: Record<string, unknown>) => { emails.push(p); return { ok: true } },
  },
}))

const { GET } = await import('./route')

const HOJE = today()
const pedido = () => new NextRequest('http://localhost/api/cron/payment-reminders')

function reserva(id: string, over: Record<string, unknown> = {}) {
  return {
    id, owner_id: 'user_1', hospede_id: 'g1', propriedade_id: 'q1',
    check_in: addDays(HOJE, 2), check_out: addDays(HOJE, 5),
    preco_total: 300, preco_pago: 0, historico: [],
    estado: 'confirmada', reserva_grupo_id: null, ...over,
  }
}

beforeEach(() => {
  emails.length = 0
  escritas.length = 0
  tabelas.bookings = [reserva('b1')]
  tabelas.guests = [{ id: 'g1', nome: 'Maria Silva', email: 'maria@exemplo.pt' }]
  tabelas.properties = [
    { id: 'q1', nome: 'Quarto Familiar', parent_id: 'casa' },
    { id: 'q2', nome: 'Quarto de Casal', parent_id: 'casa' },
    { id: 'casa', nome: 'Casa de Vasco', parent_id: null },
  ]
})

describe('GET /api/cron/payment-reminders', () => {
  it('avisa quem tem saldo em falta', async () => {
    await GET(pedido())
    expect(emails).toHaveLength(1)
    expect(emails[0].guestEmail).toBe('maria@exemplo.pt')
    expect(emails[0].saldo).toBe(300)
  })

  it('não avisa quem já pagou', async () => {
    tabelas.bookings = [reserva('b1', { preco_pago: 300 })]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('não avisa reservas sem preço (as que vêm do iCal)', async () => {
    tabelas.bookings = [reserva('b1', { preco_total: 0, preco_pago: 0 })]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('uma casa inteira dá um email com o total, não três com partes', async () => {
    /* Cada quarto mandava o seu lembrete com o seu saldo parcial: três
     * emails, três valores, nenhum deles o que a pessoa deve. */
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1', propriedade_id: 'q1', preco_total: 300 }),
      reserva('b2', { reserva_grupo_id: 'g1', propriedade_id: 'q2', preco_total: 200 }),
    ]
    await GET(pedido())

    expect(emails).toHaveLength(1)
    expect(emails[0].saldo).toBe(500)
    expect(String(emails[0].propertyName)).toContain('Casa de Vasco')
  })

  it('não repete o aviso em execuções seguintes', async () => {
    /* A janela apanha os check-ins dos próximos 3 dias: sem esta guarda, o
     * mesmo hóspede recebia o mesmo email quatro dias seguidos. */
    await GET(pedido())
    expect(emails).toHaveLength(1)

    emails.length = 0
    await GET(pedido()) // o histórico já tem a marca
    expect(emails).toHaveLength(0)
  })

  it('regista o aviso em todas as reservas do grupo', async () => {
    // Se ficasse só numa, a execução seguinte olhava para outra e repetia.
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1' }),
      reserva('b2', { reserva_grupo_id: 'g1', propriedade_id: 'q2' }),
    ]
    await GET(pedido())

    const marcados = tabelas.bookings.filter(b =>
      (b.historico as Array<{ tipo: string }>).some(h => h.tipo === 'pagamento_lembrete'),
    )
    expect(marcados).toHaveLength(2)
  })

  it('não avisa quem não tem email', async () => {
    tabelas.guests = [{ id: 'g1', nome: 'Maria', email: null }]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('não avisa check-ins fora da janela de 3 dias', async () => {
    tabelas.bookings = [reserva('b1', { check_in: addDays(HOJE, 10) })]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })
})
