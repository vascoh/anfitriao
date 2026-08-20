import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendBookingNotification } from '@/lib/notify-booking'
import { uuid } from '@/lib/utils'
import { validateBookingRequest } from '@/lib/booking-request'
import { getClientIp } from '@/lib/rate-limit'
import { verificarLimite } from '@/lib/rate-limit-persistente'

const supabase = createAdminClient()

/**
 * POST /api/book
 * Public endpoint — creates guest + booking (estado='pendente', sem
 * pagamento) from the direct booking site. Owner_id is derived from the
 * property record, not from auth. Validação/preço partilhados com
 * /api/book/checkout via lib/booking-request.ts; estado/origem são sempre
 * forçados aqui.
 */
export async function POST(req: NextRequest) {
  const rl = await verificarLimite(`book:${getClientIp(req)}`, 10, 3_600_000)
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
  const { guestId, bookingId, nome, email, telefone, notas, propriedade_id, check_in, check_out, num_hospedes, owner_id, preco_total, prop } = result.data

  const now = new Date().toISOString()

  const { error: gErr } = await supabase.from('guests').insert({
    id: guestId,
    nome,
    email,
    telefone,
    tags: ['novo'],
    notas,
    criado_em: now,
    owner_id,
  })
  if (gErr) {
    console.error('[POST /api/book] guest insert', gErr.message)
    return NextResponse.json({ error: 'Erro ao criar hóspede.' }, { status: 500 })
  }

  const { error: bErr } = await supabase.from('bookings').insert({
    id: bookingId,
    propriedade_id,
    hospede_id: guestId,
    check_in,
    check_out,
    num_hospedes,
    estado: 'pendente',
    origem: 'direto',
    preco_total,
    preco_pago: 0,
    notas,
    criado_em: now,
    historico: [{ id: uuid(), data: now, tipo: 'criada', descricao: 'Reserva criada via website direto' }],
    owner_id,
  })
  if (bErr) {
    console.error('[POST /api/book] booking insert', bErr.message)
    // Não deixar hóspede órfão se a reserva falhar
    await supabase.from('guests').delete().eq('id', guestId).eq('criado_em', now)
    return NextResponse.json({ error: 'Erro ao criar reserva.' }, { status: 500 })
  }

  // Liga quem reservou à reserva: o boletim é por pessoa, e esta é a primeira.
  await supabase.from('reserva_hospedes').insert({
    booking_id: bookingId, guest_id: guestId, principal: true, owner_id,
  })

  // Notificação por email server-side — falha não bloqueia a reserva
  try {
    await sendBookingNotification({
      bookingId,
      ownerId: owner_id,
      guestName: nome,
      guestEmail: email,
      guestPhone: telefone ?? null,
      propertyName: prop.nome ?? 'Propriedade',
      checkIn: check_in,
      checkOut: check_out,
      numHospedes: num_hospedes,
      total: preco_total,
      notas: notas ?? null,
    })
  } catch (err) {
    console.error('[POST /api/book] notify', err)
  }

  return NextResponse.json({ ok: true, bookingId, guestId })
}
