import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { adminGetBookingById, adminGetGuestById, adminGetPropertyById } from '@/lib/db-admin'
import { emailService } from '@/lib/email'
import { nights } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ ok: false, error: 'missing bookingId' }, { status: 400 })

  const booking = await adminGetBookingById(bookingId)
  if (!booking) return NextResponse.json({ ok: false, error: 'booking not found' }, { status: 404 })

  // Só o dono da reserva pode disparar o email (linhas legadas sem owner permitidas)
  if (booking.owner_id && booking.owner_id !== userId) {
    return NextResponse.json({ ok: false, error: 'booking not found' }, { status: 404 })
  }

  const [guest, prop] = await Promise.all([
    booking.hospede_id ? adminGetGuestById(booking.hospede_id) : Promise.resolve(null),
    booking.propriedade_id ? adminGetPropertyById(booking.propriedade_id) : Promise.resolve(null),
  ])

  if (!guest?.email) {
    return NextResponse.json({ ok: true, skipped: 'no_guest_email' })
  }

  const result = await emailService.sendReservationConfirmation({
    ownerId: booking.owner_id ?? null,
    bookingId,
    guestName: guest.nome,
    guestEmail: guest.email,
    propertyName: prop?.nome ?? 'Alojamento',
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    numNights: nights(booking.check_in, booking.check_out),
    numHospedes: booking.num_hospedes,
    total: booking.preco_total,
    instrucoes: prop?.instrucoes_checkin,
  })

  if (result.error === 'no_api_key') {
    return NextResponse.json({ ok: true, skipped: 'no_api_key' })
  }
  if (!result.ok) {
    console.error('[notify-confirmation]', result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
