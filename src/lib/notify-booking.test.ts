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
    sendReservationRequest: async (p: unknown) => { chamadas.pedido.push(p) },
    sendReservationConfirmation: async (p: unknown) => { chamadas.confirmada.push(p) },
    sendOwnerNotification: async (p: unknown) => { chamadas.anfitriao.push(p) },
  },
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
})
