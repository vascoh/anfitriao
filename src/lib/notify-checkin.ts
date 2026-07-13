import 'server-only'
import { Resend } from 'resend'
import { adminGetBookingById, adminGetGuestById, adminGetPropertyById, adminGetWebsiteSettings } from '@/lib/db-admin'
import { sendPushToOwner } from '@/lib/push'
import { fmtDate, escHtml } from '@/lib/utils'

/**
 * Notifica o anfitrião quando um hóspede conclui o check-in online.
 * Chamado server-side a partir de /api/checkin/[bookingId] — nunca exposto
 * como endpoint público (evita abuso do Resend do projeto).
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

  if (!process.env.RESEND_API_KEY) return
  const hostEmail = settings.email
  if (!hostEmail) return

  const from = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const sibaComplete = !!(
    guest?.numero_documento &&
    guest?.data_nascimento &&
    guest?.tipo_documento &&
    (guest?.sexo || guest?.pais_emissao)
  )

  await resend.emails.send({
    from,
    to: hostEmail,
    subject: `✓ Check-in online concluído — ${guest?.nome ?? 'Hóspede'} · ${prop?.nome ?? 'Alojamento'}`,
    html: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#10b981;"></div>
    <div style="padding:28px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Check-in online</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1209;">Hóspede registado com sucesso</h1>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534;">
          ${escHtml(guest?.nome ?? '—')}
          ${sibaComplete ? ' <span style="font-size:11px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:8px;">SIBA ✓</span>' : ''}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <td style="padding:3px 0;color:#6b5c4e;width:40%;">Propriedade</td>
            <td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(prop?.nome ?? '—')}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#6b5c4e;">Check-in</td>
            <td style="padding:3px 0;font-weight:600;color:#1a1209;">${fmtDate(booking.check_in)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;color:#6b5c4e;">Hóspedes</td>
            <td style="padding:3px 0;font-weight:600;color:#1a1209;">${booking.num_hospedes}</td>
          </tr>
          ${guest?.numero_documento ? `
          <tr>
            <td style="padding:3px 0;color:#6b5c4e;">Documento</td>
            <td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(guest.tipo_documento ?? '')} ${escHtml(guest.numero_documento)}</td>
          </tr>` : ''}
          ${guest?.nacionalidade ? `
          <tr>
            <td style="padding:3px 0;color:#6b5c4e;">Nacionalidade</td>
            <td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(guest.nacionalidade)}</td>
          </tr>` : ''}
        </table>
      </div>

      ${!sibaComplete ? `
      <div style="background:#fffbf5;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#92400e;">
          <strong>Atenção:</strong> Alguns dados SIBA estão em falta. Verifica o perfil do hóspede antes da chegada.
        </p>
      </div>` : ''}

      <p style="margin:0;font-size:12px;color:#9a8070;text-align:center;">Anfitrião · Reservas Diretas</p>
    </div>
  </div>
</body>
</html>`,
  })
}
