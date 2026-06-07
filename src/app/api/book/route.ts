import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import type { Guest, Booking } from '@/lib/types'

const supabase = createAdminClient()

/**
 * POST /api/book
 * Public endpoint — creates guest + booking from the direct booking site.
 * Owner_id is derived from the property record, not from auth.
 */
export async function POST(req: NextRequest) {
  const { guest, booking } = await req.json() as { guest: Guest; booking: Booking }

  if (!booking.propriedade_id) {
    return NextResponse.json({ error: 'propriedade_id obrigatório' }, { status: 400 })
  }

  // Derive owner from the property
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', booking.propriedade_id)
    .single()

  if (propErr || !prop) {
    return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 })
  }

  const owner_id = prop.owner_id as string | null

  const { error: gErr } = await supabase.from('guests').insert({ ...guest, owner_id })
  if (gErr) {
    console.error('[POST /api/book] guest insert', gErr.message)
    return NextResponse.json({ error: 'Erro ao criar hóspede.' }, { status: 500 })
  }

  const { error: bErr } = await supabase.from('bookings').insert({ ...booking, owner_id })
  if (bErr) {
    console.error('[POST /api/book] booking insert', bErr.message)
    return NextResponse.json({ error: 'Erro ao criar reserva.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
