import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { fetchSibaRowsForOwner } from '@/lib/siba-fetch'
import { isSibaApiConfigured, submitBookingToSiba } from '@/lib/siba-api'
import { logAudit } from '@/lib/audit'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/siba-submit
 * Body: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 * Submete automaticamente à AIMA os boletins das reservas no período (ainda
 * não submetidas com sucesso). Requer SIBA_API_URL/SIBA_API_KEY configurados
 * — enquanto não estiverem, devolve 501 e o anfitrião usa o export CSV manual
 * (`/api/siba-export`).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (!isSibaApiConfigured()) {
    return NextResponse.json(
      { error: 'Submissão automática à AIMA ainda não está configurada. Usa a exportação CSV manual.' },
      { status: 501 },
    )
  }

  const body = await req.json().catch(() => null) as { from?: string; to?: string } | null
  const from = body?.from
  const to = body?.to

  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD, from ≤ to)' }, { status: 400 })
  }

  const { rows, error: fetchError } = await fetchSibaRowsForOwner(userId, from, to)
  if (fetchError) {
    return NextResponse.json({ error: fetchError }, { status: 500 })
  }

  const supabase = createAdminClient()
  const results: Array<{ booking_id: string; success: boolean; reference?: string; error?: string }> = []

  for (const row of rows) {
    const result = await submitBookingToSiba(row)
    results.push({ booking_id: row.booking_id, ...result })

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        siba_status: result.success ? 'submetido' : 'falhou',
        siba_submitted_at: result.success ? new Date().toISOString() : null,
        siba_reference: result.reference ?? null,
        siba_error: result.error ?? null,
      })
      .eq('id', row.booking_id)
      .eq('owner_id', userId)

    if (updateError) console.error('[siba-submit]', updateError.message)
  }

  await logAudit({
    actorId: userId,
    entidade: 'siba_submissao',
    entidadeId: `${from}_${to}`,
    acao: 'submeter',
    detalhes: { total: results.length, sucesso: results.filter(r => r.success).length },
  })

  return NextResponse.json({ results })
}
