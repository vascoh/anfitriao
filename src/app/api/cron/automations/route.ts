import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { carregarTudo } from '@/lib/supabase-tudo'
import { today, addDays, fmtDate } from '@/lib/utils'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { TRIGGER_DATE, renderAutomationMessage, envioPorGrupo } from '@/lib/automations'
import type { Automation, AutomationTrigger, Booking } from '@/lib/types'

const supabase = createAdminClient()

async function bookingsForTrigger(trigger: AutomationTrigger): Promise<Booking[]> {
  const { coluna, offsetDias } = TRIGGER_DATE[trigger]
  const targetDate = addDays(today(), offsetDias)
  // Gatilhos "futuros" (check-in amanhã) só fazem sentido para reservas ainda
  // não iniciadas; "pedir avaliação" é pós-estadia — exclui só cancelamentos.
  const estados = coluna === 'check_in' || offsetDias >= 0
    ? ['confirmada', 'pendente']
    : ['confirmada', 'pendente', 'checkin', 'checkout']

  /* Paginado: esta consulta atravessa todas as contas — é filtrada por dono
   * mais abaixo, no ciclo das automações. Cortada às mil linhas, os anfitriões
   * que ficassem de fora do corte deixavam de receber automações nesse dia, em
   * silêncio e sem padrão nenhum que se notasse. */
  const { linhas, erro } = await carregarTudo<Booking>(() =>
    supabase
      .from('bookings')
      .select('*')
      .eq(coluna, targetDate)
      .in('estado', estados)
      .order('id', { ascending: true }),
  )

  if (erro) {
    console.error('[cron/automations] leitura de reservas', erro)
    throw new Error(`leitura de reservas falhou: ${erro}`)
  }

  return linhas
}

/**
 * Cron diário: executa automações ativas (lembretes/mensagens automáticas ao
 * hóspede) para reservas com check-in amanhã ou check-out hoje.
 * Idempotente via UNIQUE (automation_id, booking_id) em automation_log —
 * corridas repetidas no mesmo dia não reenviam a mesma mensagem.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('ativo', true)

  const active = (automations ?? []) as Automation[]
  if (active.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  const byTrigger = new Map<AutomationTrigger, Automation[]>()
  for (const a of active) {
    byTrigger.set(a.trigger_tipo, [...(byTrigger.get(a.trigger_tipo) ?? []), a])
  }

  let enviados = 0
  const erros: string[] = []

  for (const [trigger, autos] of byTrigger) {
    const bookings = await bookingsForTrigger(trigger)
    if (bookings.length === 0) continue

    const propIds = [...new Set(bookings.map(b => b.propriedade_id))]
    const guestIds = [...new Set(bookings.map(b => b.hospede_id).filter((id): id is string => !!id))]
    const [{ data: props }, { data: guests }] = await Promise.all([
      supabase.from('properties').select('id, nome').in('id', propIds),
      guestIds.length > 0
        ? supabase.from('guests').select('id, nome, email').in('id', guestIds)
        : Promise.resolve({ data: [] }),
    ])
    const propMap = new Map((props ?? []).map(p => [p.id, p.nome as string]))
    const guestMap = new Map((guests ?? []).map(g => [g.id, g as { nome: string; email: string | null }]))

    const { data: existingLogs } = await supabase
      .from('automation_log')
      .select('automation_id, booking_id')
      .in('automation_id', autos.map(a => a.id))
      .in('booking_id', bookings.map(b => b.id))
    const alreadySent = new Set((existingLogs ?? []).map(l => `${l.automation_id}:${l.booking_id}`))

    for (const auto of autos.filter(a => a.owner_id)) {
      const ownerBookings = bookings.filter(b => b.owner_id === auto.owner_id)

      /* Uma casa inteira são N reservas do mesmo hóspede nas mesmas datas.
       * Sem isto, ele recebia a mesma mensagem N vezes na mesma manhã. */
      for (const { principal: booking, cobertas } of envioPorGrupo(ownerBookings)) {
        const jaEnviado = [booking, ...cobertas].some(b => alreadySent.has(`${auto.id}:${b.id}`))
        if (jaEnviado) continue
        const guest = booking.hospede_id ? guestMap.get(booking.hospede_id) : null
        if (!guest?.email) continue

        const vars = {
          nome: guest.nome,
          propriedade: propMap.get(booking.propriedade_id) ?? 'o alojamento',
          checkin: fmtDate(booking.check_in),
          checkout: fmtDate(booking.check_out),
        }

        try {
          const result = await emailService.sendAutomationMessage({
            ownerId: auto.owner_id ?? null,
            guestEmail: guest.email,
            subject: renderAutomationMessage(auto.assunto, vars),
            mensagem: renderAutomationMessage(auto.mensagem, vars),
          })
          if (!result.ok) throw new Error(result.error ?? 'falha no envio')

          /* Idempotência: o UNIQUE (automation_id, booking_id) bloqueia o
           * duplicado. As reservas irmãs do grupo também ficam registadas —
           * senão a execução seguinte achava-as por enviar e a mensagem
           * repetia-se na mesma. */
          const { error: logError } = await supabase
            .from('automation_log')
            .insert([
              { automation_id: auto.id, booking_id: booking.id, resultado: 'enviado' },
              ...cobertas.map(b => ({
                automation_id: auto.id,
                booking_id: b.id,
                resultado: 'coberta_pelo_grupo',
              })),
            ])
          if (!logError) enviados++
        } catch (err) {
          erros.push(`${auto.id}/${booking.id}: ${(err as Error).message}`)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados, erros: erros.length > 0 ? erros : undefined })
}
