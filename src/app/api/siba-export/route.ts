import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { buildSibaCsv } from '@/lib/siba'
import { fetchSibaRowsForOwner } from '@/lib/siba-fetch'

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

  const { rows, error: fetchError } = await fetchSibaRowsForOwner(userId, from, to)

  if (fetchError) {
    return NextResponse.json({ error: fetchError }, { status: 500 })
  }

  if (rows.length === 0) {
    return new Response('Sem reservas no período indicado.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const csv = buildSibaCsv(rows)

  const filename = `siba-${from}-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
