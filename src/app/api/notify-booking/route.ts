import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { fmtDate, fmtMoney, nights } from '@/lib/store'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_api_key' })
  }

  const {
    bookingId, guestName, guestEmail, guestPhone,
    propertyName, checkIn, checkOut, numHospedes, total, notas,
  } = await req.json()

  const settings = await db.getWebsiteSettings()
  const hostTo = process.env.NOTIFY_EMAIL || settings.email
  const from = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitriao-nine.vercel.app'
  const numNights = nights(checkIn, checkOut)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const sends: Promise<unknown>[] = []

  if (hostTo) {
    sends.push(
      resend.emails.send({
        from,
        to: hostTo,
        subject: `Nova reserva — ${propertyName} · ${fmtDate(checkIn)}`,
        html: buildHostEmail({ bookingId, guestName, guestEmail, guestPhone, propertyName, checkIn, checkOut, numNights, numHospedes, total, notas, baseUrl }),
      })
    )
  }

  if (guestEmail) {
    const hostName = settings.host_nome || settings.nome
    const hostContact = settings.telefone || settings.email || ''
    sends.push(
      resend.emails.send({
        from,
        to: guestEmail,
        subject: `Pedido de reserva recebido — ${propertyName}`,
        html: buildGuestEmail({ guestName, propertyName, checkIn, checkOut, numNights, numHospedes, total, hostName, hostContact, notas }),
      })
    )
  }

  try {
    await Promise.all(sends)
  } catch (err) {
    console.error('[notify-booking]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

interface HostEmailProps {
  bookingId: string
  guestName: string
  guestEmail: string
  guestPhone: string | null
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  numHospedes: number
  total: number
  notas: string | null
  baseUrl: string
}

interface GuestEmailProps {
  guestName: string
  propertyName: string
  checkIn: string
  checkOut: string
  numNights: number
  numHospedes: number
  total: number
  hostName: string
  hostContact: string
  notas: string | null
}

function buildHostEmail(p: HostEmailProps): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Nova reserva pendente</p>
      <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">${p.propertyName}</h1>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
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
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Total estimado</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#C2714F;">${fmtMoney(p.total)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom:${p.notas ? '20px' : '24px'};">
        <p style="margin:0 0 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Hóspede</p>
        <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#1a1209;">${p.guestName}</p>
        <p style="margin:0 0 3px;font-size:13px;color:#6b5c4e;">${p.guestEmail}</p>
        ${p.guestPhone ? `<p style="margin:0;font-size:13px;color:#6b5c4e;">${p.guestPhone}</p>` : ''}
      </div>

      ${p.notas ? `
      <div style="margin-bottom:24px;background:#fffbf5;border:1px solid #ede8e0;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Notas do hóspede</p>
        <p style="margin:0;font-size:13px;color:#6b5c4e;line-height:1.55;">${p.notas}</p>
      </div>` : ''}

      <a href="${p.baseUrl}/reservas/${p.bookingId}"
        style="display:block;text-align:center;background:#C2714F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:700;">
        Ver reserva no painel →
      </a>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Gestão de Alojamento Local</p>
    </div>
  </div>
</body>
</html>`
}

function buildGuestEmail(p: GuestEmailProps): string {
  const firstName = p.guestName.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Pedido de reserva</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">Recebemos o teu pedido!</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">Olá ${firstName}, o teu pedido de reserva em <strong>${p.propertyName}</strong> foi recebido com sucesso. O anfitrião irá confirmar em breve.</p>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a1209;">${p.propertyName}</p>
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
            <td style="padding:5px 0;font-size:12px;color:#9a8070;">Total estimado</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#C2714F;">${fmtMoney(p.total)}</td>
          </tr>
        </table>
      </div>

      ${p.notas ? `
      <div style="margin-bottom:24px;background:#fffbf5;border:1px solid #ede8e0;border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">As tuas notas</p>
        <p style="margin:0;font-size:13px;color:#6b5c4e;line-height:1.55;">${p.notas}</p>
      </div>` : ''}

      <div style="background:#f0f7ff;border:1px solid #cce0f5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#1a5a8a;">Próximos passos</p>
        <p style="margin:0 0 4px;font-size:13px;color:#2c6da4;line-height:1.5;">O anfitrião irá confirmar a reserva e combinar o pagamento diretamente contigo.</p>
        ${p.hostContact ? `<p style="margin:4px 0 0;font-size:13px;color:#2c6da4;">Contacto: <strong>${p.hostContact}</strong></p>` : ''}
      </div>

      <div style="border-top:1px solid #ede8e0;padding-top:18px;">
        <p style="margin:0;font-size:12px;color:#9a8070;line-height:1.6;">
          Este pedido foi feito diretamente com <strong>${p.hostName}</strong>, sem taxas de intermediários.
          Ao reservar diretamente, garantes o melhor preço e contacto direto com o anfitrião.
        </p>
      </div>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Reservas Diretas</p>
    </div>
  </div>
</body>
</html>`
}
