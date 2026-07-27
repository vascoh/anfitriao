import { NextRequest, NextResponse } from 'next/server'
import { validateBookingRequest } from '@/lib/booking-request'
import { getAccountByClerkId } from '@/lib/accounts'
import { createGuestCheckoutSession } from '@/lib/stripe-connect'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { APP_URL } from '@/lib/config'

/**
 * POST /api/book/checkout
 * Cria uma Checkout Session de pagamento (cartão) diretamente na conta
 * Stripe Connect do anfitrião — ver lib/stripe-connect.ts. A reserva só é
 * criada depois de o pagamento ser confirmado (webhook ou fallback síncrono
 * em /api/book-checkout-fulfill), nunca aqui.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`book-checkout:${getClientIp(req)}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tenta mais tarde.' }, { status: 429 })
  }

  let payload: { guest?: Record<string, unknown>; booking?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const result = await validateBookingRequest(payload)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  const { bookingId, guestId, nome, email, telefone, notas, propriedade_id, check_in, check_out, num_hospedes, owner_id, preco_total, prop } = result.data

  if (!owner_id) {
    return NextResponse.json({ error: 'Alojamento sem anfitrião associado.' }, { status: 400 })
  }
  const account = await getAccountByClerkId(owner_id)
  if (!account?.stripe_connect_account_id || !account.stripe_connect_charges_enabled) {
    return NextResponse.json({ error: 'Este anfitrião ainda não aceita pagamento online. Usa "Pedir reserva" em baixo.' }, { status: 400 })
  }

  if (preco_total <= 0) {
    return NextResponse.json({ error: 'Valor inválido para pagamento.' }, { status: 400 })
  }

  const session = await createGuestCheckoutSession({
    connectAccountId: account.stripe_connect_account_id,
    bookingId,
    guestId,
    propertyName: prop.nome,
    amountCents: Math.round(preco_total * 100),
    successUrl: `${APP_URL}/book/${propriedade_id}/confirmacao?b=${bookingId}&session_id={CHECKOUT_SESSION_ID}&nome=${encodeURIComponent(nome)}`,
    cancelUrl: `${APP_URL}/book/${propriedade_id}`,
    metadata: {
      bookingId, guestId, propriedade_id, check_in, check_out,
      owner_id, nome, email,
      telefone: telefone ?? '',
      notas: (notas ?? '').slice(0, 450),
      num_hospedes: String(num_hospedes),
      preco_total: String(preco_total),
      propriedade_nome: prop.nome.slice(0, 200),
    },
  })

  return NextResponse.json({ url: session.url })
}
