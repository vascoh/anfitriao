import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { buildSibaCsv } from '@/lib/siba'

const supabase = createAdminClient()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/siba-export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Exporta CSV com dados SIBA dos hóspedes para o período indicado.
 * Requer autenticação Clerk.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD, from ≤ to)' }, { status: 400 })
  }

  // Fetch bookings in range for this owner
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, num_hospedes, hospede_id, propriedade_id')
    .eq('owner_id', userId)
    .gte('check_in', from)
    .lte('check_in', to)
    .not('estado', 'in', '("cancelada","no_show")')
    .order('check_in', { ascending: true })

  if (bookingsError) {
    console.error('[siba-export]', bookingsError.message)
    return NextResponse.json({ error: 'Erro ao carregar reservas' }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return new Response('Sem reservas no período indicado.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Fetch guests and properties
  const guestIds = bookings.map(b => b.hospede_id).filter(Boolean) as string[]
  const propIds = [...new Set(bookings.map(b => b.propriedade_id))]

  const [guestsRes, propsRes] = await Promise.all([
    guestIds.length > 0
      ? supabase.from('guests').select('id, nome, data_nascimento, nacionalidade, numero_documento, tipo_documento, data_validade_doc, sexo, pais_emissao').in('id', guestIds)
      : Promise.resolve({ data: [] }),
    supabase.from('properties').select('id, nome').in('id', propIds),
  ])

  const guestMap = new Map((guestsRes.data ?? []).map(g => [g.id, g]))
  const propMap = new Map((propsRes.data ?? []).map(p => [p.id, p]))

  const csv = buildSibaCsv(bookings.map(b => {
    const g = guestMap.get(b.hospede_id ?? '')
    return {
      check_in: b.check_in,
      check_out: b.check_out,
      num_hospedes: b.num_hospedes,
      alojamento: propMap.get(b.propriedade_id)?.nome ?? '',
      nome: g?.nome ?? '',
      data_nascimento: g?.data_nascimento,
      nacionalidade: g?.nacionalidade,
      numero_documento: g?.numero_documento,
      tipo_documento: g?.tipo_documento,
      data_validade_doc: g?.data_validade_doc,
      sexo: g?.sexo,
      pais_emissao: g?.pais_emissao,
    }
  }))

  const filename = `siba-${from}-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
