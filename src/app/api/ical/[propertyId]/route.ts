import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase'
import { generateIcal } from '@/lib/ical'
import { eBloqueio } from '@/lib/reservations'
const supabase = createAdminClient()

export const revalidate = 300

// UID estável mas não reversível: o id real da reserva não pode sair num feed
// público — dá acesso ao GET /api/checkin/[bookingId] (PII do hóspede).
function publicUid(bookingId: string): string {
  return createHash('sha256').update(`anfitriao-ical:${bookingId}`).digest('hex').slice(0, 32)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  const [{ data: prop }, { data: quartos }] = await Promise.all([
    supabase.from('properties').select('id, nome, owner_id').eq('id', propertyId).single(),
    supabase.from('properties').select('id, ativo, owner_id').eq('parent_id', propertyId),
  ])

  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  /* Numa casa com quartos, a ocupação vive nos quartos — a casa-mãe não tem
   * reservas próprias desde que deixou de ser unidade alugável (30/07).
   * Exportar só as dela dava um feed **sempre vazio**: quem o colasse no
   * Amenitiz ou no Airbnb via a casa livre todos os dias e vendia por cima de
   * reservas que existem. Uma casa está ocupada quando **qualquer** quarto
   * seu está — é o que este feed passa a dizer. */
  const idsOcupacao = [
    propertyId,
    ...(quartos ?? [])
      .filter(q => q.ativo !== false)
      // Só quartos do mesmo dono: um `parent_id` apontado de fora não injeta
      // datas no calendário que este anfitrião publica nas plataformas.
      .filter(q => q.owner_id === prop.owner_id)
      .map(q => q.id as string),
  ]

  const { data: bookings } = await supabase
    .from('bookings').select('id, hospede_id, uid_externo, check_in, check_out, estado')
    .in('propriedade_id', idsOcupacao)
    .not('estado', 'in', '("cancelada","no_show")')

  // Sem nomes de hóspedes: o feed é acessível a qualquer pessoa que conheça o
  // propertyId (visível nos URLs públicos /book) — só datas de ocupação.
  const events = (bookings ?? []).map(b => ({
    uid: `${publicUid(b.id as string)}@anfitriao`,
    // Uma reserva importada de um canal não tem hóspede (o iCal não o
    // transporta) e não é um bloqueio — ver `eBloqueio`.
    summary: eBloqueio(b as { hospede_id: string | null; uid_externo?: string }) ? 'Bloqueado' : 'Reservado',
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
