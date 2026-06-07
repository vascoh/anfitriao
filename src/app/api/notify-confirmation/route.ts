import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { adminGetBookingById, adminGetGuestById, adminGetPropertyById, adminGetWebsiteSettings } from '@/lib/db-admin'
import { fmtDate, fmtMoney, nights, escHtml } from '@/lib/utils'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_api_key' })
  }

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ ok: false, error: 'missing bookingId' }, { status: 400 })

  const booking = await adminGetBookingById(bookingId)
  if (!booking) return NextResponse.json({ ok: false, error: 'booking not found' }, { status: 404 })

  const [guest, prop, settings] = await Promise.all([
    booking.hospede_id ? adminGetGuestById(booking.hospede_id) : Promise.resolve(null),
    booking.propriedade_id ? adminGetPropertyById(booking.propriedade_id) : Promise.resolve(null),
    adminGetWebsiteSettings(booking.owner_id),
  ])

  if (!guest?.email) {
    return NextResponse.json({ ok: true, skipped: 'no_guest_email' })
  }

  const from = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitriao-nine.vercel.app'
  const numNights = nights(booking.check_in, booking.check_out)
  const hostName = settings.host_nome || settings.nome
  const hostContact = settings.telefone || settings.email || ''
  const checkinLink = `${baseUrl}/checkin/${bookingId}`

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from,
      to: guest.email,
      subject: `Reserva confirmada — ${prop?.nome ?? 'Alojamento'}`,
      html: buildConfirmationEmail({
        guestName: guest.nome,
        propertyName: prop?.nome ?? 'Alojamento',
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        numNights,
        numHospedes: booking.num_hospedes,
        total: booking.preco_total,
        hostName,
        hostContact,
        checkinLink,
        instrucoes: prop?.instrucoes_checkin,
      }),
    })
  } catch (err) {
    console.error('[notify-confirmation]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function buildConfirmationEmail(p: {
  guestName: string
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  numHospedes: number
  total: number
  hostName: string
  hostContact: string
  checkinLink: string
  instrucoes?: string | null
}): string {
  const firstName = p.guestName.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Reserva confirmada ✓</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">A tua estadia está confirmada!</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">Olá ${escHtml(firstName)}, a tua reserva em <strong>${escHtml(p.propertyName)}</strong> foi confirmada. Estamos a aguardar a tua chegada!</p>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a1209;">${escHtml(p.propertyName)}</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;width:42%;">Check-in</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(p.checkIn)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Check-out</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(p.checkOut)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Noites</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${p.numNights}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Hóspedes</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${p.numHospedes}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Total</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#C2714F;">${fmtMoney(p.total)}</td>
          </tr>
        </table>
      </div>

      ${p.instrucoes ? `
      <div style="margin-bottom:24px;background:#fffbf5;border:1px solid #ede8e0;border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Instruções de check-in</p>
        <p style="margin:0;font-size:13px;color:#6b5c4e;line-height:1.6;">${escHtml(p.instrucoes)}</p>
      </div>` : ''}

      <a href="${p.checkinLink}"
        style="display:block;text-align:center;background:#C2714F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:16px;">
        Fazer check-in online →
      </a>
      <p style="margin:0 0 24px;font-size:12px;color:#9a8070;text-align:center;">Demora menos de 1 minuto. Obrigatório por lei (SIBA/SEF).</p>

      <div style="border-top:1px solid #ede8e0;padding-top:18px;">
        <p style="margin:0 0 4px;font-size:12px;color:#9a8070;">Anfitrião: <strong style="color:#1a1209;">${escHtml(p.hostName)}</strong></p>
        ${p.hostContact ? `<p style="margin:0;font-size:12px;color:#9a8070;">Contacto: <strong style="color:#1a1209;">${escHtml(p.hostContact)}</strong></p>` : ''}
      </div>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Reservas Diretas</p>
    </div>
  </div>
</body>
</html>`
}
