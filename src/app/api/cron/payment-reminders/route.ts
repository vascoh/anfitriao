import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { today, addDays, fmtMoney, nights } from '@/lib/utils'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
const supabase = createAdminClient()

// Cron: sends payment reminders 3 days before check-in for bookings with outstanding balance
// Schedule: daily at 09:00 (see vercel.json)
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const t = today()
  const cutoffStr = addDays(t, 3)

  // Bookings with check-in in the next 3 days, confirmed/pendente, with balance
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, owner_id, hospede_id, propriedade_id, check_in, check_out, preco_total, preco_pago, historico')
    .in('estado', ['confirmada', 'pendente'])
    .gte('check_in', t)
    .lte('check_in', cutoffStr)

  if (error || !bookings) {
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }

  const due = bookings.filter(b => b.preco_total > 0 && b.preco_pago < b.preco_total && b.hospede_id)
  if (due.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const [{ data: guests }, { data: properties }] = await Promise.all([
    supabase.from('guests').select('id, nome, email').in('id', due.map(b => b.hospede_id)),
    supabase.from('properties').select('id, nome').in('id', [...new Set(due.map(b => b.propriedade_id))]),
  ])

  const guestMap = new Map((guests ?? []).map(g => [g.id, g]))
  const propMap = new Map((properties ?? []).map(p => [p.id, p]))

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

    const result = await emailService.sendPaymentReminder({
      ownerId: booking.owner_id,
      guestName: guest.nome,
      guestEmail: guest.email,
      propertyName: prop?.nome ?? 'Alojamento',
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      numNights: nights(booking.check_in, booking.check_out),
      total: booking.preco_total,
      pago: booking.preco_pago,
      saldo,
    })
    if (!result.ok) continue // não falha o cron por um email

    // Mark in historico so we don't resend today
    await supabase.from('bookings').update({
      historico: [...historico, {
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        tipo: 'pagamento_lembrete',
        descricao: `Lembrete de pagamento enviado automaticamente (${fmtMoney(saldo)} em falta)`,
      }],
    }).eq('id', booking.id)

    sent++
  }

  return NextResponse.json({ ok: true, sent, checked: due.length })
}
