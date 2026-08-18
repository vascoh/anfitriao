import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Preenchimento de uma reserva paga.
 *
 * Corre duas vezes de propósito — pelo webhook do Stripe e pela página de
 * confirmação — porque o hóspede não devia esperar pelo webhook para ver a
 * reserva feita. Isso torna a idempotência a propriedade central: duas
 * chamadas para a mesma sessão não podem dar duas reservas.
 *
 * E há um estado que não pode existir em silêncio: dinheiro cobrado sem
 * reserva nenhuma, quando as datas ficam ocupadas entre o pagamento e a
 * confirmação e o reembolso automático falha.
 */

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; tipo: string; dados: unknown }> = []
let erroInsertBooking: { code?: string; message: string } | null = null

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    single: async () => ({ data: alvo()[0] ?? null, error: null }),
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      insert: async (dados: Record<string, unknown>) => {
        escritas.push({ tabela, tipo: 'insert', dados })
        if (tabela === 'bookings' && erroInsertBooking) return { error: erroInsertBooking }
        ;(tabelas[tabela] ??= []).push(dados)
        return { error: null }
      },
      upsert: async (dados: Record<string, unknown>) => {
        escritas.push({ tabela, tipo: 'upsert', dados })
        return { error: null }
      },
    }),
  }),
}))

let haConflito = false
vi.mock('./booking-request', () => ({ hasConflict: async () => haConflito }))

const notificacoes: unknown[] = []
vi.mock('./notify-booking', () => ({
  sendBookingNotification: async (p: unknown) => { notificacoes.push(p) },
}))

/** Sessão do Stripe, como ela chega da API deles. */
let sessao: Record<string, unknown> = {}
vi.mock('./stripe-connect', () => ({
  retrieveGuestCheckoutSession: async () => sessao,
}))

let reembolsoRebenta = false
const reembolsos: unknown[] = []
vi.mock('./stripe', () => ({
  stripe: {
    refunds: {
      create: async (p: unknown) => {
        if (reembolsoRebenta) throw new Error('cartão já devolvido')
        reembolsos.push(p)
        return { id: 're_1' }
      },
    },
  },
}))

const auditoria: Array<Record<string, unknown>> = []
vi.mock('./audit', () => ({ logAudit: async (p: Record<string, unknown>) => { auditoria.push(p) } }))

const { fulfillCheckoutSession } = await import('./checkout-fulfillment')

const METADATA = {
  bookingId: 'b1', guestId: 'g1', propriedade_id: 'p1',
  check_in: '2026-09-10', check_out: '2026-09-13',
  owner_id: 'user_1', nome: 'Maria Silva', email: 'maria@exemplo.pt',
  telefone: '912345678', notas: '', num_hospedes: '2', preco_total: '300',
  propriedade_nome: 'Casa de Vasco',
}

beforeEach(() => {
  escritas.length = 0
  reembolsos.length = 0
  notificacoes.length = 0
  auditoria.length = 0
  haConflito = false
  reembolsoRebenta = false
  erroInsertBooking = null
  tabelas.bookings = []
  tabelas.guests = []
  sessao = { payment_status: 'paid', payment_intent: 'pi_1', metadata: { ...METADATA } }
})

describe('fulfillCheckoutSession', () => {
  it('cria hóspede e reserva pagas', async () => {
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(r.ok).toBe(true)

    const reserva = escritas.find(e => e.tabela === 'bookings')?.dados as Record<string, unknown>
    expect(reserva.estado).toBe('confirmada')
    expect(reserva.preco_pago).toBe(300)
    expect(reserva.stripe_checkout_session_id).toBe('cs_1')
    expect(notificacoes).toHaveLength(1)
  })

  it('liga quem pagou à reserva — o boletim é por pessoa', async () => {
    /* Todos os outros caminhos ligam quem reservou; este não ligava ninguém,
     * e o SIBA respondia "reserva sem hóspedes" numa reserva com nome, email
     * e dinheiro pago. */
    await fulfillCheckoutSession('acct_1', 'cs_1')
    const ligacao = escritas.find(e => e.tabela === 'reserva_hospedes')?.dados as Record<string, unknown>
    expect(ligacao.guest_id).toBe('g1')
    expect(ligacao.principal).toBe(true)
  })

  it('a segunda chamada devolve a mesma reserva, não cria outra', async () => {
    // Webhook e página de confirmação correm os dois, de propósito.
    tabelas.bookings = [{ id: 'b1', stripe_checkout_session_id: 'cs_1' }]
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')

    expect(r).toMatchObject({ ok: true, bookingId: 'b1', alreadyFulfilled: true })
    expect(escritas).toHaveLength(0)
  })

  it('uma corrida com o webhook não duplica a reserva', async () => {
    // O UNIQUE em stripe_checkout_session_id trava o segundo insert.
    erroInsertBooking = { code: '23505', message: 'duplicate key' }
    tabelas.bookings = []

    const promessa = fulfillCheckoutSession('acct_1', 'cs_1')
    tabelas.bookings.push({ id: 'b1', stripe_checkout_session_id: 'cs_1' })
    const r = await promessa

    expect(r.ok).toBe(true)
    expect((r as { alreadyFulfilled: boolean }).alreadyFulfilled).toBe(true)
  })

  it('não cria nada se o pagamento não foi feito', async () => {
    sessao = { ...sessao, payment_status: 'unpaid' }
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(r).toEqual({ ok: false, reason: 'not_paid' })
    expect(escritas).toHaveLength(0)
  })

  it('metadata incompleta não vira reserva a metade', async () => {
    sessao = { ...sessao, metadata: { ...METADATA, check_in: undefined } }
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(r).toEqual({ ok: false, reason: 'invalid_metadata' })
    expect(escritas).toHaveLength(0)
  })

  it('datas ocupadas entretanto: reembolsa e não cria reserva', async () => {
    haConflito = true
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')

    expect(r).toEqual({ ok: false, reason: 'conflict_refunded' })
    expect(reembolsos).toHaveLength(1)
    expect(escritas.filter(e => e.tabela === 'bookings')).toHaveLength(0)
  })

  it('o reembolso fica registado na auditoria', async () => {
    haConflito = true
    await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(auditoria[0].acao).toBe('reembolso_por_conflito')
  })

  it('um reembolso falhado deixa rasto — é dinheiro cobrado sem reserva', async () => {
    /* O pior estado possível, e o único que ninguém descobre sozinho: antes
     * era só um console.error. */
    haConflito = true
    reembolsoRebenta = true
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')

    expect(r).toEqual({ ok: false, reason: 'conflict_refunded' })
    expect(auditoria[0].acao).toBe('reembolso_por_conflito_falhou')
    expect((auditoria[0].detalhes as Record<string, unknown>).valor).toBe(300)
    expect((auditoria[0].detalhes as Record<string, unknown>).erro).toContain('devolvido')
  })

  it('uma sessão sem payment_intent também deixa rasto', async () => {
    haConflito = true
    sessao = { ...sessao, payment_intent: null }
    await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(auditoria[0].acao).toBe('reembolso_por_conflito_falhou')
  })

  it('o email ao anfitrião não pode fazer falhar a reserva', async () => {
    notificacoes.length = 0
    const r = await fulfillCheckoutSession('acct_1', 'cs_1')
    expect(r.ok).toBe(true)
  })
})
