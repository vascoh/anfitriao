import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { emitirFaturaDaReserva, emitirNotaCredito } from '@/lib/faturacao/emitir'

const supabase = createAdminClient()

/**
 * GET /api/faturas — reservas faturáveis e já faturadas do anfitrião.
 * POST /api/faturas — emite a fatura-recibo de uma reserva.
 * DELETE /api/faturas — anula por nota de crédito.
 *
 * A lógica de emissão vive em `lib/faturacao/emitir.ts`, partilhada com o cron
 * que emite sozinho no checkout.
 */

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const limite = Math.min(Math.max(Number(url.searchParams.get('limite') ?? 100), 1), 200)

  const { data, error } = await supabase
    .from('bookings')
    .select('id, propriedade_id, hospede_id, check_in, check_out, estado, preco_total, reserva_grupo_id, fatura_estado, fatura_numero, fatura_url, fatura_total, fatura_emitida_em, fatura_erro, fatura_reservada_em, nota_credito_numero, nota_credito_emitida_em')
    .eq('owner_id', userId)
    .not('estado', 'in', '("cancelada","no_show")')
    .order('check_out', { ascending: false })
    .limit(limite)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`faturas:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const bookingId = body && typeof body.bookingId === 'string' ? body.bookingId : ''
  if (!bookingId) return NextResponse.json({ error: 'bookingId em falta' }, { status: 400 })

  const r = await emitirFaturaDaReserva(userId, bookingId)
  if (!r.ok) return NextResponse.json({ error: r.erro, motivo: r.motivo }, { status: r.estado })

  await logAudit({
    actorId: userId,
    entidade: 'booking',
    entidadeId: bookingId,
    acao: 'fatura_emitida',
    detalhes: { numero: r.numero, atcud: r.atcud, total: r.total },
  })

  return NextResponse.json(r)
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`notas-credito:${userId}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as { bookingId?: string; motivo?: string } | null
  const bookingId = body?.bookingId
  if (!bookingId) return NextResponse.json({ error: 'bookingId em falta' }, { status: 400 })

  const r = await emitirNotaCredito(userId, bookingId, body?.motivo)
  if (!r.ok) return NextResponse.json({ error: r.erro, motivo: r.motivo }, { status: r.estado })

  await logAudit({
    actorId: userId,
    entidade: 'booking',
    entidadeId: bookingId,
    acao: 'nota_credito_emitida',
    detalhes: { numero: r.numero, motivo: body?.motivo },
  })

  return NextResponse.json(r)
}
