import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Qual email o hóspede recebe depende de a reserva já estar confirmada.
 *
 * O caminho pago por Stripe (`checkout-fulfillment.ts`) cria a reserva já
 * `confirmada` — não há nada a esperar do anfitrião. Sem `jaConfirmada`, esta
 * função mandava sempre o email de "pedido recebido, aguarda confirmação",
 * mesmo a quem já tinha pago e via no ecrã "a tua reserva está garantida".
 */

vi.mock('@/lib/db-admin', () => ({
  adminGetWebsiteSettings: async () => ({ email: 'anfitriao@exemplo.pt' }),
}))

vi.mock('@/lib/push', () => ({ sendPushToOwner: async () => {} }))

vi.mock('@/lib/notification-preferences', () => ({
  getNotificationPreferences: async () => ({ nova_reserva_push: true, nova_reserva_email: true }),
}))

const chamadas: { pedido: unknown[]; confirmada: unknown[]; anfitriao: unknown[] } = {
  pedido: [], confirmada: [], anfitriao: [],
}

vi.mock('@/lib/email', () => ({
  emailService: {
    sendReservationRequest: async (p: unknown) => { chamadas.pedido.push(p); return { ok: true, subject: 'Pedido' } },
    sendReservationConfirmation: async (p: unknown) => { chamadas.confirmada.push(p); return { ok: true, subject: 'Confirmada' } },
    sendOwnerNotification: async (p: unknown) => { chamadas.anfitriao.push(p) },
  },
}))

vi.mock('@/lib/supabase', () => ({ createAdminClient: () => ({}) }))

const registos: Array<Record<string, unknown>> = []
vi.mock('@/lib/mensagens-server', () => ({
  enderecoDeResposta: (id: string) => `r+${id}.assinatura@respostas.exemplo.pt`,
  registarEmailAutomatico: async (_s: unknown, p: Record<string, unknown>) => { registos.push(p) },
}))

const { sendBookingNotification } = await import('./notify-booking')

const BASE = {
  bookingId: 'b1',
  ownerId: 'user_1',
  guestName: 'Maria Silva',
  guestEmail: 'maria@exemplo.pt',
  guestPhone: null,
  propertyName: 'Casa de Vasco',
  checkIn: '2026-09-10',
  checkOut: '2026-09-13',
  numHospedes: 2,
  total: 300,
  notas: null,
}

beforeEach(() => {
  chamadas.pedido.length = 0
  chamadas.confirmada.length = 0
  chamadas.anfitriao.length = 0
  registos.length = 0
})

describe('sendBookingNotification', () => {
  it('sem jaConfirmada, manda o email de pedido pendente', async () => {
    await sendBookingNotification(BASE)
    expect(chamadas.pedido).toHaveLength(1)
    expect(chamadas.confirmada).toHaveLength(0)
  })

  it('com jaConfirmada, manda o email de reserva confirmada (com link de check-in)', async () => {
    await sendBookingNotification({ ...BASE, jaConfirmada: true })
    expect(chamadas.confirmada).toHaveLength(1)
    expect(chamadas.pedido).toHaveLength(0)
  })

  it('o anfitrião é notificado nos dois casos', async () => {
    await sendBookingNotification({ ...BASE, jaConfirmada: true })
    expect(chamadas.anfitriao).toHaveLength(1)
  })

  it('o email ao hóspede sai com o endereço de resposta da conversa e fica registado nela', async () => {
    await sendBookingNotification({ ...BASE, guestId: 'g1', jaConfirmada: true })
    expect((chamadas.confirmada[0] as { replyTo: string }).replyTo).toBe('r+b1.assinatura@respostas.exemplo.pt')
    expect(registos).toEqual([expect.objectContaining({
      reservaId: 'b1', hospedeId: 'g1', origem: 'confirmacao', assunto: 'Confirmada',
    })])
  })

  it('o pedido pendente fica registado como pedido', async () => {
    await sendBookingNotification(BASE)
    expect(registos[0]).toMatchObject({ origem: 'pedido', reservaId: 'b1' })
  })
})
