import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getAccountByClerkId } from '@/lib/accounts'
import { fulfillCheckoutSession } from '@/lib/checkout-fulfillment'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const supabase = createAdminClient()

/**
 * GET /api/book-checkout-fulfill?session_id=...&propriedade_id=...
 * Fallback síncrono chamado pela página de confirmação (o hóspede não devia
 * ter de esperar pelo webhook para ver a reserva confirmada). Idempotente —
 * ver lib/checkout-fulfillment.ts. O webhook Stripe continua a ser o
 * mecanismo fiável caso o hóspede feche o separador antes de voltar.
 */
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`book-checkout-fulfill:${getClientIp(req)}`, 20, 3_600_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })

  const sessionId = req.nextUrl.searchParams.get('session_id')
  const propriedadeId = req.nextUrl.searchParams.get('propriedade_id')
  if (!sessionId || !propriedadeId) {
    return NextResponse.json({ error: 'Parâmetros em falta.' }, { status: 400 })
  }

  const { data: prop } = await supabase.from('properties').select('owner_id').eq('id', propriedadeId).maybeSingle()
  const ownerId = prop?.owner_id as string | undefined
  if (!ownerId) return NextResponse.json({ error: 'Propriedade não encontrada.' }, { status: 404 })

  const account = await getAccountByClerkId(ownerId)
  if (!account?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Anfitrião sem pagamentos configurados.' }, { status: 400 })
  }

  const result = await fulfillCheckoutSession(account.stripe_connect_account_id, sessionId)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 })
  }
  return NextResponse.json({ ok: true, bookingId: result.bookingId })
}
