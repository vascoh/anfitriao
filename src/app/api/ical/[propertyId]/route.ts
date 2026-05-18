import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateIcal } from '@/lib/ical'

export const revalidate = 300

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  const [{ data: prop }, { data: bookings }, { data: guests }] = await Promise.all([
    supabase.from('properties').select('id, nome').eq('id', propertyId).single(),
    supabase.from('bookings').select('id, hospede_id, check_in, check_out, estado')
      .eq('propriedade_id', propertyId)
      .not('estado', 'in', '("cancelada","no_show")'),
    supabase.from('guests').select('id, nome'),
  ])

  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const guestMap = new Map((guests ?? []).map(g => [g.id, g.nome as string]))

  const events = (bookings ?? []).map(b => ({
    uid: `${b.id}@anfitriao`,
    summary: b.hospede_id ? (guestMap.get(b.hospede_id) ?? 'Reservado') : 'Bloqueado',
    start: b.check_in as string,
    end: b.check_out as string,
  }))

  const ics = generateIcal(events, prop.nome as string)

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${propertyId}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
