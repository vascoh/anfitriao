import 'server-only'
import { adminGetWebsiteSettings } from '@/lib/db-admin'
import { emailService } from '@/lib/email'
import { sendPushToOwner } from '@/lib/push'
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
}

/**
 * Notifica nova reserva: push para os dispositivos do anfitrião + emails
 * (anfitrião e hóspede) via emailService. Chamado server-side a partir de
 * /api/book — nunca exposto como endpoint público.
 */
export async function sendBookingNotification(p: BookingNotification): Promise<void> {
  // Push primeiro — não depende do provider de email e nunca lança
  await sendPushToOwner(p.ownerId, {
    title: `Nova reserva — ${p.propertyName}`,
    body: `${p.guestName} · ${fmtDate(p.checkIn)} → ${fmtDate(p.checkOut)} · ${fmtMoney(p.total)}`,
    url: `/reservas/${p.bookingId}`,
  })

  const settings = await adminGetWebsiteSettings(p.ownerId)
  const numNights = nights(p.checkIn, p.checkOut)
  const sends: Promise<unknown>[] = []

  if (settings.email) {
    sends.push(emailService.sendOwnerNotification({
      ...p,
      ownerEmail: settings.email,
      numNights,
    }))
  }

  if (p.guestEmail) {
    sends.push(emailService.sendReservationRequest({
      ...p,
      numNights,
    }))
  }

  await Promise.all(sends)
}
