import 'server-only'
import { createAdminClient } from './supabase'
import { uuid } from './utils'
import { sendBookingNotification } from './notify-booking'
import { hasConflict } from './booking-request'
import { retrieveGuestCheckoutSession } from './stripe-connect'
import { stripe } from './stripe'

export type FulfillResult =
  | { ok: true; bookingId: string; alreadyFulfilled: boolean }
  | { ok: false; reason: 'not_paid' | 'conflict_refunded' | 'invalid_metadata' | 'error' }

/**
 * Confirma o pagamento de uma Checkout Session de reserva e cria a
 * reserva/hóspede. Chamado tanto pelo webhook Stripe (fiável, assíncrono)
 * como pela página de confirmação (síncrono, para o hóspede ver logo o
 * resultado sem esperar pelo webhook) — por isso é idempotente:
 * `stripe_checkout_session_id` é UNIQUE em `bookings`, uma segunda chamada
 * para a mesma sessão devolve a reserva já criada em vez de duplicar.
 *
 * Reverifica conflito de datas no momento do preenchimento (pode ter passado
 * tempo desde a criação da sessão) — se surgiu um conflito real, reembolsa
 * automaticamente em vez de criar uma reserva sobre datas já ocupadas.
 */
export async function fulfillCheckoutSession(connectAccountId: string, sessionId: string): Promise<FulfillResult> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()
  if (existing) return { ok: true, bookingId: existing.id as string, alreadyFulfilled: true }

  const session = await retrieveGuestCheckoutSession(connectAccountId, sessionId)
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not_paid' }

  const m = session.metadata ?? {}
  const { bookingId, guestId, propriedade_id, check_in, check_out, owner_id, nome, email } = m
  const num_hospedes = Number(m.num_hospedes)
  const preco_total = Number(m.preco_total)
  if (!bookingId || !guestId || !propriedade_id || !check_in || !check_out || !nome || !email ||
      !Number.isFinite(num_hospedes) || !Number.isFinite(preco_total)) {
    console.error('[fulfillCheckoutSession] metadata inválida', sessionId, m)
    return { ok: false, reason: 'invalid_metadata' }
  }

  if (await hasConflict(propriedade_id, check_in, check_out)) {
    try {
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId }, { stripeAccount: connectAccountId })
      }
    } catch (err) {
      console.error('[fulfillCheckoutSession] falha ao reembolsar após conflito', sessionId, err)
    }
    return { ok: false, reason: 'conflict_refunded' }
  }

  const now = new Date().toISOString()

  const { error: gErr } = await supabase.from('guests').upsert({
    id: guestId,
    nome,
    email,
    telefone: m.telefone || undefined,
    tags: ['novo'],
    notas: m.notas || undefined,
    criado_em: now,
    owner_id: owner_id || null,
  })
  if (gErr) {
    console.error('[fulfillCheckoutSession] guest upsert', gErr.message)
    return { ok: false, reason: 'error' }
  }

  const { error: bErr } = await supabase.from('bookings').insert({
    id: bookingId,
    propriedade_id,
    hospede_id: guestId,
    check_in,
    check_out,
    num_hospedes,
    estado: 'confirmada',
    origem: 'direto',
    preco_total,
    preco_pago: preco_total,
    notas: m.notas || undefined,
    criado_em: now,
    stripe_checkout_session_id: sessionId,
    historico: [
      { id: uuid(), data: now, tipo: 'criada', descricao: 'Reserva criada via website direto' },
      { id: uuid(), data: now, tipo: 'pagamento', descricao: 'Pagamento confirmado via Stripe (cartão)' },
    ],
    owner_id: owner_id || null,
  })
  if (bErr) {
    // Corrida com o webhook: a outra chamada já inseriu entretanto — idempotente, não é erro real.
    if (bErr.code === '23505') {
      const { data: race } = await supabase
        .from('bookings')
        .select('id')
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle()
      if (race) return { ok: true, bookingId: race.id as string, alreadyFulfilled: true }
    }
    console.error('[fulfillCheckoutSession] booking insert', bErr.message)
    return { ok: false, reason: 'error' }
  }

  try {
    await sendBookingNotification({
      bookingId,
      ownerId: owner_id || null,
      guestName: nome,
      guestEmail: email,
      guestPhone: m.telefone || null,
      propertyName: m.propriedade_nome || 'Propriedade',
      checkIn: check_in,
      checkOut: check_out,
      numHospedes: num_hospedes,
      total: preco_total,
      notas: m.notas || null,
    })
  } catch (err) {
    console.error('[fulfillCheckoutSession] notify', err)
  }

  return { ok: true, bookingId, alreadyFulfilled: false }
}
