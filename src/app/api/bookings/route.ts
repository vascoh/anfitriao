import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Booking } from '@/lib/types'
import { canUpsertRow, ownsProperty } from '@/lib/ownership'
import { logAudit } from '@/lib/audit'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('owner_id', userId)
    .order('check_in', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/bookings
 * Guarda uma reserva com owner_id do utilizador autenticado.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: Booking
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!(await canUpsertRow(supabase, 'bookings', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar esta reserva.' }, { status: 403 })
  }

  /* A reserva é minha, mas o alojamento é de quem?
   *
   * O id de uma propriedade é público — está no URL de `/book/[id]` e nos
   * links do site do anfitrião. Sem esta verificação, qualquer pessoa com
   * conta podia criar reservas no alojamento de outra: `hasConflict` procura
   * por propriedade e não por dono, portanto o site do vizinho passava a
   * responder "datas ocupadas" a todos os hóspedes — e ele não via nada, pois
   * o calendário dele só mostra as reservas com o `owner_id` dele. */
  if (!(await ownsProperty(supabase, body.propriedade_id, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  // O mesmo para a ficha do hóspede: uma reserva não empresta o acesso aos
  // dados de alguém que é cliente de outro anfitrião.
  if (!(await canUpsertRow(supabase, 'guests', body.hospede_id, userId))) {
    return NextResponse.json({ error: 'Hóspede não encontrado.' }, { status: 404 })
  }

  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('bookings').upsert(row)
  if (error) {
    console.error('[POST /api/bookings]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar reserva.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  /* Guardar o que se vai apagar, para o registo dizer alguma coisa.
   *
   * Apagar uma reserva é irreversível e leva com ela o histórico, os
   * pagamentos registados e a ligação aos hóspedes. Apagar uma **propriedade**
   * já ficava no `audit_log` desde julho; apagar uma reserva não — e é a
   * mesma classe de ação. A assimetria não tinha razão de ser. */
  const { data: existente } = await supabase
    .from('bookings')
    .select('check_in, check_out, preco_total, estado, hospede_id, propriedade_id')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  const { error } = await supabase.from('bookings').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/bookings]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  if (existente) {
    await logAudit({
      actorId: userId,
      entidade: 'booking',
      entidadeId: id,
      acao: 'eliminada',
      detalhes: {
        datas: `${existente.check_in} → ${existente.check_out}`,
        estado: existente.estado,
        valor: existente.preco_total,
        propriedade_id: existente.propriedade_id,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
