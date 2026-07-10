import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Booking } from '@/lib/types'
import { canUpsertRow } from '@/lib/ownership'

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

  const { error } = await supabase.from('bookings').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/bookings]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
