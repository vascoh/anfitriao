import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'

const supabase = createAdminClient()

function esc(v: string | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function parseDatePt(s: string | null | undefined): string {
  if (!s) return ''
  // Handle DD/MM/YYYY from OCR
  if (s.includes('/')) {
    const [d, m, y] = s.split('/')
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : s
  }
  return s
}

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

  if (!from || !to) {
    return NextResponse.json({ error: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD)' }, { status: 400 })
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

  const header = ['Check-in', 'Check-out', 'Nº Hóspedes', 'Alojamento', 'Nome', 'Data Nascimento', 'Nacionalidade', 'Nº Documento', 'Tipo Documento', 'Validade Documento', 'Sexo', 'País Emissão']
  const rows = bookings.map(b => {
    const g = guestMap.get(b.hospede_id ?? '')
    const p = propMap.get(b.propriedade_id)
    return [
      b.check_in,
      b.check_out,
      String(b.num_hospedes),
      p?.nome ?? '',
      g?.nome ?? '',
      parseDatePt(g?.data_nascimento),
      g?.nacionalidade ?? '',
      g?.numero_documento ?? '',
      g?.tipo_documento ?? '',
      parseDatePt(g?.data_validade_doc),
      g?.sexo ?? '',
      g?.pais_emissao ?? '',
    ].map(v => esc(v)).join(',')
  })

  const csv = '﻿' + [header.map(h => esc(h)).join(','), ...rows].join('\r\n')
  const filename = `siba-${from}-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
