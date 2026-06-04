import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { today, fmtDate, fmtMoney, nights } from '@/lib/utils'
import { Resend } from 'resend'
import { checkCronAuth } from '@/lib/cron-auth'
const supabase = createAdminClient()

// Cron: sends payment reminders 3 days before check-in for bookings with outstanding balance
// Schedule: daily at 09:00 (see vercel.json)
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_api_key', sent: 0 })
  }

  const t = today()
  const cutoff = new Date(t)
  cutoff.setDate(cutoff.getDate() + 3)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Bookings with check-in in the next 3 days, confirmed/pendente, with balance
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, hospede_id, propriedade_id, check_in, check_out, preco_total, preco_pago, historico')
    .in('estado', ['confirmada', 'pendente'])
    .gte('check_in', t)
    .lte('check_in', cutoffStr)

  if (error || !bookings) {
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }

  const due = bookings.filter(b => b.preco_total > 0 && b.preco_pago < b.preco_total && b.hospede_id)
  if (due.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const [{ data: guests }, { data: properties }, { data: settings }] = await Promise.all([
    supabase.from('guests').select('id, nome, email').in('id', due.map(b => b.hospede_id)),
    supabase.from('properties').select('id, nome').in('id', [...new Set(due.map(b => b.propriedade_id))]),
    supabase.from('website_settings').select('*').eq('id', 1).single(),
  ])

  const guestMap = new Map((guests ?? []).map(g => [g.id, g]))
  const propMap = new Map((properties ?? []).map(p => [p.id, p]))

  const hostName = (settings as { host_nome?: string; nome?: string } | null)?.host_nome
    || (settings as { nome?: string } | null)?.nome
    || 'O seu anfitrião'
  const hostContact = (settings as { telefone?: string; email?: string } | null)?.telefone
    || (settings as { email?: string } | null)?.email
    || ''
  const from = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'
  const resend = new Resend(process.env.RESEND_API_KEY)

  let sent = 0

  for (const booking of due) {
    const guest = guestMap.get(booking.hospede_id)
    if (!guest?.email) continue

    // Skip if we already sent a reminder today (check historico)
    const historico: Array<{ tipo: string; data: string }> = Array.isArray(booking.historico) ? booking.historico : []
    const alreadySentToday = historico.some(e => e.tipo === 'pagamento_lembrete' && e.data?.startsWith(t))
    if (alreadySentToday) continue

    const prop = propMap.get(booking.propriedade_id)
    const saldo = booking.preco_total - booking.preco_pago
    const numNights = nights(booking.check_in, booking.check_out)
    const firstName = guest.nome.split(' ')[0]

    try {
      await resend.emails.send({
        from,
        to: guest.email,
        subject: `Pagamento pendente — ${prop?.nome ?? 'Alojamento'} · ${fmtDate(booking.check_in)}`,
        html: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Lembrete automático</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">Pagamento pendente</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">Olá ${firstName}, o teu check-in em <strong>${prop?.nome ?? 'Alojamento'}</strong> é daqui a poucos dias. Existe ainda um valor em aberto.</p>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a1209;">${prop?.nome ?? 'Alojamento'}</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:5px 0;font-size:12px;color:#9a8070;width:42%;">Check-in</td><td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(booking.check_in)}</td></tr>
          <tr><td style="padding:5px 0;font-size:12px;color:#9a8070;">Check-out</td><td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtDate(booking.check_out)}</td></tr>
          <tr><td style="padding:5px 0;font-size:12px;color:#9a8070;">Noites</td><td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${numNights}</td></tr>
          <tr><td style="padding:5px 0;font-size:12px;color:#9a8070;">Total reserva</td><td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtMoney(booking.preco_total)}</td></tr>
          <tr><td style="padding:5px 0;font-size:12px;color:#9a8070;">Já pago</td><td style="padding:5px 0;font-size:14px;font-weight:600;color:#1a1209;">${fmtMoney(booking.preco_pago)}</td></tr>
          <tr style="border-top:1px solid #ede8e0;">
            <td style="padding:8px 0 5px;font-size:12px;font-weight:700;color:#9a8070;">Valor em falta</td>
            <td style="padding:8px 0 5px;font-size:16px;font-weight:700;color:#C2714F;">${fmtMoney(saldo)}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 24px;font-size:13px;color:#6b5c4e;line-height:1.6;">Por favor entra em contacto para combinar o pagamento antes da chegada. Podes responder a este email ou contactar diretamente.</p>

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

      // Mark in historico so we don't resend today
      await supabase.from('bookings').update({
        historico: [...historico, {
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          tipo: 'pagamento_lembrete',
          descricao: `Lembrete de pagamento enviado automaticamente (€${fmtMoney(saldo)} em falta)`,
        }],
      }).eq('id', booking.id)

      sent++
    } catch {
      // continue — don't fail the whole cron if one email fails
    }
  }

  return NextResponse.json({ ok: true, sent, checked: due.length })
}
