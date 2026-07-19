import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { checkCronAuth } from '@/lib/cron-auth'
import { escHtml } from '@/lib/utils'
import { APP_URL, NOTIFY_FROM } from '@/lib/config'
const supabase = createAdminClient()

// Cron: envia emails de aviso de trial a expirar
// Disparado: diariamente às 10:00 (ver vercel.json)
// Envia quando faltam exactamente 3 dias e 1 dia
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no_resend_key', sent: 0 })
  }

  const now  = new Date()
  const from = NOTIFY_FROM
  const baseUrl = APP_URL
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Janelas de tempo: faltam 3 dias ou falta 1 dia
  // Para cada janela: [início, fim] inclusive
  const windows = [
    { daysLeft: 3, start: addDays(now, 3), end: addDays(now, 3, true) },
    { daysLeft: 1, start: addDays(now, 1), end: addDays(now, 1, true) },
  ]

  let sent = 0

  for (const w of windows) {
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, email, nome, trial_ends_at, estado')
      .eq('estado', 'trial')
      .gte('trial_ends_at', w.start)
      .lte('trial_ends_at', w.end)

    if (error || !accounts) continue

    for (const account of accounts) {
      if (!account.email) continue

      const firstName = account.nome?.split(' ')[0] ?? 'Olá'
      const trialDate = new Date(account.trial_ends_at).toLocaleDateString('pt-PT', {
        day: 'numeric', month: 'long',
      })

      try {
        await resend.emails.send({
          from,
          to: account.email,
          subject: w.daysLeft === 1
            ? '⏰ O teu trial Anfitrião termina amanhã'
            : `⏳ ${w.daysLeft} dias até ao fim do teu trial Anfitrião`,
          html: buildTrialEmail({ firstName, daysLeft: w.daysLeft, trialDate, baseUrl }),
        })
        sent++
      } catch {
        // continua — não falha o cron por um email
      }
    }
  }

  // Também enviar para contas cujo trial expirou HOJE (mas não expirou ontem)
  // para apanhar quem perdemos com a janela de cima
  const expiredTodayStart = new Date(now)
  expiredTodayStart.setHours(0, 0, 0, 0)
  const expiredTodayEnd = new Date(now)
  expiredTodayEnd.setHours(23, 59, 59, 999)

  const { data: expired } = await supabase
    .from('accounts')
    .select('id, email, nome, trial_ends_at')
    .eq('estado', 'trial')
    .gte('trial_ends_at', expiredTodayStart.toISOString())
    .lte('trial_ends_at', expiredTodayEnd.toISOString())

  for (const account of expired ?? []) {
    if (!account.email) continue
    const firstName = account.nome?.split(' ')[0] ?? 'Olá'
    try {
      await resend.emails.send({
        from,
        to: account.email,
        subject: '🔔 O teu trial Anfitrião expirou hoje',
        html: buildExpiredEmail({ firstName, baseUrl }),
      })
      sent++
    } catch { /* continua */ }
  }

  return NextResponse.json({ ok: true, sent })
}

// ─── Helpers de data ──────────────────────────────────────────────────────────

function addDays(date: Date, days: number, endOfDay = false): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  if (endOfDay) {
    d.setHours(23, 59, 59, 999)
  } else {
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

// ─── Templates de email ───────────────────────────────────────────────────────

function buildTrialEmail({ firstName, daysLeft, trialDate, baseUrl }: {
  firstName: string
  daysLeft: number
  trialDate: string
  baseUrl: string
}) {
  const urgency = daysLeft === 1
    ? 'Amanhã é o último dia do teu trial gratuito.'
    : `O teu trial gratuito termina em ${daysLeft} dias (${trialDate}).`

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Trial a expirar</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">Olá ${escHtml(firstName)}!</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">${urgency} Escolhe um plano para continuares a gerir as tuas propriedades sem interrupções.</p>

      <div style="background:#f9f5f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1a1209;">O que continuas a ter com um plano pago:</p>
        <ul style="margin:0;padding-left:16px;color:#6b5c4e;font-size:13px;line-height:1.8;">
          <li>AI Concierge para responder em qualquer idioma</li>
          <li>Check-in online dos hóspedes</li>
          <li>SIBA / SEF automático</li>
          <li>Calendário com sync de Airbnb e Booking</li>
          <li>Website de reservas directas</li>
        </ul>
      </div>

      <a href="${baseUrl}/conta/billing"
        style="display:block;text-align:center;background:#C2714F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:700;">
        Escolher plano agora →
      </a>

      <p style="margin:20px 0 0;font-size:12px;color:#9a8070;text-align:center;">
        Starter a €19/mês · Pro a €39/mês · Cancela quando quiseres
      </p>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Gestão de Alojamento Local</p>
    </div>
  </div>
</body>
</html>`
}

function buildExpiredEmail({ firstName, baseUrl }: { firstName: string; baseUrl: string }) {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f5f0;padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ede8e0;">
    <div style="height:4px;background:#C2714F;"></div>
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9a8070;">Trial expirado</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1209;line-height:1.2;">O teu trial terminou, ${escHtml(firstName)}</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b5c4e;line-height:1.55;">
        O teu período de trial gratuito chegou ao fim. Para continuares a aceder ao Anfitrião, escolhe um plano.
        Os teus dados estão guardados e não vai perder nada.
      </p>

      <a href="${baseUrl}/conta/billing"
        style="display:block;text-align:center;background:#C2714F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:16px;">
        Reactivar conta →
      </a>

      <p style="margin:0;font-size:12px;color:#9a8070;text-align:center;">
        Starter a €19/mês · Pro a €39/mês
      </p>
    </div>
    <div style="padding:14px 32px;border-top:1px solid #ede8e0;background:#f9f5f0;">
      <p style="margin:0;font-size:11px;color:#9a8070;text-align:center;">Anfitrião · Gestão de Alojamento Local</p>
    </div>
  </div>
</body>
</html>`
}
