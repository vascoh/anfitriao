import 'server-only'
import { adminGetBookingById, adminGetGuestById, adminGetPropertyById, adminGetWebsiteSettings } from '@/lib/db-admin'
import { emailService } from '@/lib/email'
import { sendPushToOwner } from '@/lib/push'

/**
 * Notifica o anfitrião quando um hóspede conclui o check-in online.
 * Chamado server-side a partir de /api/checkin/[bookingId] — nunca exposto
 * como endpoint público (evita abuso do provider de email).
 */
export async function sendCheckinCompleteNotification(bookingId: string): Promise<void> {
  const booking = await adminGetBookingById(bookingId)
  if (!booking) return

  const [guest, prop, settings] = await Promise.all([
    booking.hospede_id ? adminGetGuestById(booking.hospede_id) : Promise.resolve(null),
    booking.propriedade_id ? adminGetPropertyById(booking.propriedade_id) : Promise.resolve(null),
    adminGetWebsiteSettings(booking.owner_id),
  ])

  // Push independente do email
  await sendPushToOwner(booking.owner_id, {
    title: 'Check-in online concluído',
    body: `${guest?.nome ?? 'Hóspede'} · ${prop?.nome ?? 'Alojamento'}`,
    url: `/reservas/${bookingId}`,
  })

  if (!settings.email) return

  const sibaComplete = !!(
    guest?.numero_documento &&
    guest?.data_nascimento &&
    guest?.tipo_documento &&
    (guest?.sexo || guest?.pais_emissao)
  )

  await emailService.sendCheckinComplete({
    ownerId: booking.owner_id ?? null,
    ownerEmail: settings.email,
    guestName: guest?.nome ?? 'Hóspede',
    propertyName: prop?.nome ?? 'Alojamento',
    checkIn: booking.check_in,
    numHospedes: booking.num_hospedes,
    documento: guest?.numero_documento
      ? `${guest.tipo_documento ?? ''} ${guest.numero_documento}`.trim()
      : null,
    nacionalidade: guest?.nacionalidade ?? null,
    sibaComplete,
  })
}
