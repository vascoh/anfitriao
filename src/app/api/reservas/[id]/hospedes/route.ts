import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { estadoDosBoletins, ordenarHospedes, type HospedeDaReserva } from '@/lib/hospedes-reserva'
import type { Guest } from '@/lib/types'

const supabase = createAdminClient()

/**
 * GET /api/reservas/[id]/hospedes — quem está nesta reserva, e o que falta
 * para os boletins poderem ser entregues.
 *
 * O boletim de alojamento é por pessoa. Esta rota é o que permite a interface
 * dizer "faltam os dados de 5 hóspedes" em vez de dar a reserva por tratada
 * só porque quem reservou preencheu a ficha dele.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, owner_id, hospede_id, num_hospedes, check_in, check_out')
    .eq('id', id)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
  if (booking.owner_id !== null && booking.owner_id !== userId) {
    return NextResponse.json({ error: 'Sem permissão para esta reserva.' }, { status: 403 })
  }

  const { data: ligacoes } = await supabase
    .from('reserva_hospedes')
    .select('guest_id, principal')
    .eq('booking_id', id)

  // Rede de segurança para reservas anteriores à tabela de ligação.
  const registos = (ligacoes ?? []).length > 0
    ? (ligacoes ?? [])
    : booking.hospede_id
      ? [{ guest_id: booking.hospede_id, principal: true }]
      : []

  const ids = registos.map(r => r.guest_id as string)
  const { data: guests } = ids.length > 0
    ? await supabase.from('guests').select('*').in('id', ids)
    : { data: [] as Guest[] }

  const porId = new Map((guests ?? []).map(g => [g.id as string, g as Guest]))

  const hospedes: HospedeDaReserva[] = registos
    .map(r => {
      const guest = porId.get(r.guest_id as string)
      return guest ? { guest, principal: Boolean(r.principal) } : null
    })
    .filter(Boolean) as HospedeDaReserva[]

  const estado = estadoDosBoletins(
    booking.num_hospedes ?? hospedes.length,
    hospedes,
    booking.check_in,
    booking.check_out,
  )

  return NextResponse.json({
    hospedes: ordenarHospedes(hospedes).map(h => ({
      id: h.guest.id,
      nome: h.guest.nome,
      nacionalidade: h.guest.nacionalidade ?? null,
      principal: h.principal,
      faltam: estado.incompletos.find(i => i.guest.id === h.guest.id)?.faltam ?? [],
    })),
    estado: {
      esperados: estado.esperados,
      registados: estado.registados,
      prontos: estado.prontos,
      porRegistar: estado.porRegistar,
      completo: estado.completo,
    },
  })
}
