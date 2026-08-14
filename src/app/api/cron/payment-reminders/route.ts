import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { today, addDays, fmtMoney, nights } from '@/lib/utils'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { agruparReservas } from '@/lib/grupos'
import type { Booking } from '@/lib/types'
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
    .select('id, owner_id, hospede_id, propriedade_id, check_in, check_out, preco_total, preco_pago, historico, estado, reserva_grupo_id')
    .in('estado', ['confirmada', 'pendente'])
    .gte('check_in', t)
    .lte('check_in', cutoffStr)

  if (error || !bookings) {
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }

  /* Uma casa alugada por inteiro são N reservas do mesmo hóspede, e o que ele
   * deve é o total — não N saldos parciais em N emails. Agrupar antes de
   * decidir é o que faz a diferença entre um lembrete e três. */
  const grupos = agruparReservas(bookings as Booking[])
    .filter(g => g.reservas[0].hospede_id && g.precoTotal > 0 && g.precoTotal > g.precoPago)

  if (grupos.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const idsHospedes = [...new Set(grupos.map(g => g.reservas[0].hospede_id as string))]
  const idsPropriedades = [...new Set(grupos.flatMap(g => g.reservas.map(b => b.propriedade_id)))]

  const [{ data: guests }, { data: properties }] = await Promise.all([
    supabase.from('guests').select('id, nome, email').in('id', idsHospedes),
    supabase.from('properties').select('id, nome, parent_id').in('id', idsPropriedades),
  ])

  const guestMap = new Map((guests ?? []).map(g => [g.id, g]))
  const propMap = new Map((properties ?? []).map(p => [p.id, p]))

  // Nome da casa-mãe, para um grupo poder dizer "casa inteira" em vez do
  // nome de um dos quartos.
  const idsPais = [...new Set((properties ?? []).map(p => p.parent_id).filter(Boolean))] as string[]
  const { data: pais } = idsPais.length > 0
    ? await supabase.from('properties').select('id, nome').in('id', idsPais)
    : { data: [] }
  const paiMap = new Map((pais ?? []).map(p => [p.id, p.nome as string]))

  let sent = 0

  for (const grupo of grupos) {
    const primeira = grupo.reservas[0]
    const guest = guestMap.get(primeira.hospede_id as string)
    if (!guest?.email) continue

    /* Uma vez por reserva, não uma vez por dia.
     *
     * A janela apanha os check-ins dos próximos 3 dias, portanto o mesmo
     * hóspede voltava a receber o mesmo email em cada execução — quatro dias
     * seguidos, incluindo depois de já ter pago por transferência e de o
     * anfitrião ainda não ter registado o valor. */
    const jaAvisado = grupo.reservas.some(b => {
      const historico: Array<{ tipo: string }> = Array.isArray(b.historico) ? b.historico : []
      return historico.some(e => e.tipo === 'pagamento_lembrete')
    })
    if (jaAvisado) continue

    const prop = propMap.get(primeira.propriedade_id)
    const nomeCasa = prop?.parent_id ? paiMap.get(prop.parent_id as string) : null
    const nomeAlojamento = grupo.reservas.length > 1 && nomeCasa
      ? `${nomeCasa} — casa inteira (${grupo.reservas.length} quartos)`
      : prop?.nome ?? 'Alojamento'

    const saldo = Math.round((grupo.precoTotal - grupo.precoPago) * 100) / 100

    const result = await emailService.sendPaymentReminder({
      ownerId: primeira.owner_id ?? null,
      guestName: guest.nome,
      guestEmail: guest.email,
      propertyName: nomeAlojamento,
      checkIn: grupo.checkIn,
      checkOut: grupo.checkOut,
      numNights: nights(grupo.checkIn, grupo.checkOut),
      total: grupo.precoTotal,
      pago: grupo.precoPago,
      saldo,
    })
    if (!result.ok) continue // não falha o cron por um email

    // O registo vai a todas as reservas do grupo: se ficasse só numa, a
    // execução de amanhã olhava para outra e mandava o email outra vez.
    for (const b of grupo.reservas) {
      const historico = Array.isArray(b.historico) ? b.historico : []
      await supabase.from('bookings').update({
        historico: [...historico, {
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          tipo: 'pagamento_lembrete',
          descricao: `Lembrete de pagamento enviado automaticamente (${fmtMoney(saldo)} em falta)`,
        }],
      }).eq('id', b.id)
    }

    sent++
  }

  return NextResponse.json({ ok: true, sent, checked: grupos.length })
}
