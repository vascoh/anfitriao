import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
const supabase = createAdminClient()

// Cron: envia emails de aviso de trial a expirar (emails de PLATAFORMA)
// Disparado: diariamente às 10:00 (ver vercel.json)
// Envia quando faltam exactamente 3 dias e 1 dia
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const now = new Date()

  // Janelas de tempo: faltam 3 dias ou falta 1 dia
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

      const result = await emailService.sendTrialEnding({
        to: account.email,
        firstName: account.nome?.split(' ')[0] ?? 'Olá',
        daysLeft: w.daysLeft,
        trialDate: new Date(account.trial_ends_at).toLocaleDateString('pt-PT', {
          day: 'numeric', month: 'long',
        }),
      })
      if (result.ok) sent++ // não falha o cron por um email
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
    const result = await emailService.sendTrialExpired({
      to: account.email,
      firstName: account.nome?.split(' ')[0] ?? 'Olá',
    })
    if (result.ok) sent++
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
