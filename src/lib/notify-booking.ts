import 'server-only'
import { adminGetWebsiteSettings } from '@/lib/db-admin'
import { emailService } from '@/lib/email'
import { sendPushToOwner } from '@/lib/push'
import { getNotificationPreferences } from '@/lib/notification-preferences'
import { fmtDate, fmtMoney, nights } from '@/lib/utils'

export interface BookingNotification {
  bookingId: string
  ownerId: string | null
  guestName: string
  guestEmail: string
  guestPhone: string | null
  propertyName: string
  checkIn: string
  checkOut: string
  numHospedes: number
  total: number
  notas: string | null
  /**
   * Verdadeiro quando a reserva nasce já `confirmada` — o caminho pago por
   * Stripe (`checkout-fulfillment.ts`), em que não há confirmação do
   * anfitrião a esperar. Sem isto, o hóspede que já pagou recebia o mesmo
   * "recebemos o teu pedido, o anfitrião confirma em breve" de quem ainda
   * não pagou nada — a contradizer o ecrã de confirmação, que lhe diz que a
   * reserva "está garantida" — e nunca chegava a receber o link de check-in
   * online por email, porque esse só sai do lado de `/api/notify-confirmation`,
   * que só corre quando um anfitrião confirma uma reserva pendente à mão.
   */
  jaConfirmada?: boolean
}

/**
 * Notifica nova reserva: push para os dispositivos do anfitrião + emails
 * (anfitrião e hóspede) via emailService. Chamado server-side a partir de
 * /api/book — nunca exposto como endpoint público.
 */
export async function sendBookingNotification(p: BookingNotification): Promise<void> {
  const prefs = await getNotificationPreferences(p.ownerId)

  // Push primeiro — não depende do provider de email e nunca lança
  if (prefs.nova_reserva_push) {
    await sendPushToOwner(p.ownerId, {
      title: `Nova reserva — ${p.propertyName}`,
      body: `${p.guestName} · ${fmtDate(p.checkIn)} → ${fmtDate(p.checkOut)} · ${fmtMoney(p.total)}`,
      url: `/reservas/${p.bookingId}`,
    })
  }

  const settings = await adminGetWebsiteSettings(p.ownerId)
  const numNights = nights(p.checkIn, p.checkOut)
  const sends: Promise<unknown>[] = []

  if (settings.email && prefs.nova_reserva_email) {
    sends.push(emailService.sendOwnerNotification({
      ...p,
      ownerEmail: settings.email,
      numNights,
    }))
  }

  if (p.guestEmail) {
    sends.push(
      p.jaConfirmada
        ? emailService.sendReservationConfirmation({ ...p, numNights })
        : emailService.sendReservationRequest({ ...p, numNights }),
    )
  }

  await Promise.all(sends)
}
