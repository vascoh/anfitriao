import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendBookingNotification } from '@/lib/notify-booking'
import { uuid } from '@/lib/utils'
import { validateGroupBookingRequest } from '@/lib/booking-request'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const supabase = createAdminClient()

/**
 * POST /api/book/grupo — pedido de **casa inteira** vindo do site público.
 *
 * Cria um hóspede e uma reserva por quarto, todas `pendente` e ligadas pelo
 * mesmo `reserva_grupo_id`. É o equivalente de grupo do `/api/book`: sem
 * pagamento, o anfitrião confirma.
 *
 * Duas coisas que aqui não podem ser meias:
 *
 * 1. **Ou entram todas as reservas, ou não entra nenhuma.** O insert é uma só
 *    instrução. Um hóspede que reservou "a casa" e ficou com dois dos três
 *    quartos só descobre à chegada, com o grupo à porta.
 * 2. **O hóspede é o mesmo em todas.** Quem reservou a casa é uma pessoa, não
 *    três — e é a ela que se responde.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`book-grupo:${getClientIp(req)}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tenta mais tarde.' }, { status: 429 })
  }

  let payload: { guest?: Record<string, unknown>; booking?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const result = await validateGroupBookingRequest(payload)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const {
    guestId, grupoId, nome, email, telefone, notas,
    casa, quartos, check_in, check_out, num_hospedes, owner_id, preco_total,
  } = result.data

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
    console.error('[POST /api/book/grupo] guest insert', gErr.message)
    return NextResponse.json({ error: 'Erro ao criar hóspede.' }, { status: 500 })
  }

  const linhas = quartos.map(({ quarto, preco, pessoas }) => ({
    id: uuid(),
    propriedade_id: quarto.id,
    hospede_id: guestId,
    check_in,
    check_out,
    num_hospedes: pessoas,
    estado: 'pendente',
    origem: 'direto',
    preco_total: preco,
    preco_pago: 0,
    notas,
    criado_em: now,
    historico: [{
      id: uuid(),
      data: now,
      tipo: 'criada',
      descricao: `Pedido de casa inteira via website — ${casa.nome}, ${quartos.length} quartos, ${num_hospedes} ${num_hospedes === 1 ? 'pessoa' : 'pessoas'}`,
    }],
    owner_id,
    reserva_grupo_id: grupoId,
  }))

  const { error: bErr } = await supabase.from('bookings').insert(linhas)
  if (bErr) {
    console.error('[POST /api/book/grupo] bookings insert', bErr.message)
    // Não deixar hóspede órfão se as reservas falharem.
    await supabase.from('guests').delete().eq('id', guestId).eq('criado_em', now)
    return NextResponse.json({ error: 'Erro ao criar a reserva.' }, { status: 500 })
  }

  /* Quem reservou fica ligado a **um** quarto, não a todos.
   *
   * `reserva_hospedes` diz quem dorme onde — é dela que sai um boletim por
   * pessoa. Ligar a mesma pessoa aos três quartos punha as três reservas a
   * parecerem completas: a mesma pessoa declarada três vezes ao SIBA e os
   * acompanhantes nunca declarados. O contacto de quem reservou vive em
   * `bookings.hospede_id`, que continua em todas as reservas do grupo.
   *
   * Os restantes ocupantes entram no check-in, que é quando se sabem os nomes. */
  await supabase.from('reserva_hospedes').insert({
    booking_id: linhas[0].id, guest_id: guestId, principal: true, owner_id,
  })

  // Uma notificação, não uma por quarto: o anfitrião recebeu um pedido.
  try {
    await sendBookingNotification({
      bookingId: linhas[0].id,
      ownerId: owner_id,
      guestName: nome,
      guestEmail: email,
      guestPhone: telefone ?? null,
      propertyName: `${casa.nome} — casa inteira (${quartos.length} quartos)`,
      checkIn: check_in,
      checkOut: check_out,
      numHospedes: num_hospedes,
      total: preco_total,
      notas: notas ?? null,
    })
  } catch (err) {
    console.error('[POST /api/book/grupo] notify', err)
  }

  return NextResponse.json({
    ok: true,
    grupoId,
    guestId,
    bookingId: linhas[0].id,
    reservas: linhas.length,
    total: preco_total,
  })
}
