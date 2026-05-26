import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { fmtDate, fmtMoney, nights } from '@/lib/utils'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_api_key' })
  }

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ ok: false, error: 'missing bookingId' }, { status: 400 })

  const [bookings, guests, properties, settings] = await Promise.all([
    db.getBookings(),
    db.getGuests(),
    db.getProperties(),
    db.getWebsiteSettings(),
  ])

  const booking = bookings.find(b => b.id === bookingId)
  if (!booking) return NextResponse.json({ ok: false, error: 'booking not found' }, { status: 404 })

  const saldo = booking.preco_total - booking.preco_pago
  if (saldo <= 0) return NextResponse.json({ ok: true, skipped: 'no_balance' })

  const guest = booking.hospede_id ? guests.find(g => g.id === booking.hospede_id) : null
  const prop = properties.find(p => p.id === booking.propriedade_id)

  if (!guest?.email) return NextResponse.json({ ok: true, skipped: 'no_guest_email' })

  const from = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'
  const hostName = settings.host_nome || settings.nome
  const hostContact = settings.telefone || settings.email || ''
  const numNights = nights(booking.check_in, booking.check_out)
  const firstName = guest.nome.split(' ')[0]

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from,
      to: guest.email,
      subject: `Lembrete de pagamento — ${prop?.nome ?? 'Alojamento'}`,
      html: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Lembrete</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">Pagamento pendente</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">Olá ${firstName}, este é um lembrete de que existe um valor em aberto relativo à tua estadia em <strong>${prop?.nome ?? 'Alojamento'}</strong>.</p>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a1209;">${prop?.nome ?? 'Alojamento'}</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;width:42%;">Check-in</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(booking.check_in)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Check-out</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(booking.check_out)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Noites</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${numNights}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Total reserva</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtMoney(booking.preco_total)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Já pago</td>
            <td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtMoney(booking.preco_pago)}</td>
          </tr>
          <tr style="border-top:1px solid #ede8e0;">
            <td style="padding:8px 0 5px;font-size:12px;font-weight:700;color:#9a8070;">Valor em falta</td>
            <td style="padding:8px 0 5px;font-size:16px;font-weight:700;color:#C2714F;">${fmtMoney(saldo)}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 24px;font-size:13px;color:#6b5c4e;line-height:1.6;">
        Por favor entra em contacto comigo para combinar o pagamento. Podes responder a este email ou contactar diretamente.
      </p>

      <div style="border-top:1px solid #ede8e0;padding-top:18px;">
        <p style="margin:0 0 4px;font-size:12px;color:#9a8070;">Anfitrião: <strong style="color:#1a1209;">${hostName}</strong></p>
        ${hostContact ? `<p style="margin:0;font-size:12px;color:#9a8070;">Contacto: <strong style="color:#1a1209;">${hostContact}</strong></p>` : ''}
      </div>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Reservas Diretas</p>
    </div>
  </div>
</body>
</html>`,
    })
  } catch (err) {
    console.error('[notify-payment-reminder]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
