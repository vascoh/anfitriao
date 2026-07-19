import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendBookingNotification } from '@/lib/notify-booking'
import { uuid, nights, today } from '@/lib/utils'
import { calculatePriceWithRules } from '@/lib/reservations'
import { adminGetPriceRules, adminGetTarifas, adminGetPlatformRates } from '@/lib/db-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { Property } from '@/lib/types'

const supabase = createAdminClient()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * POST /api/book
 * Public endpoint — creates guest + booking from the direct booking site.
 * Owner_id is derived from the property record, not from auth.
 * Fields are whitelisted server-side; estado/origem are forced (pendente/direto).
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`book:${getClientIp(req)}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tenta mais tarde.' }, { status: 429 })
  }

  let payload: { guest?: Record<string, unknown>; booking?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return bad('JSON inválido')
  }

  const guest = payload?.guest ?? {}
  const booking = payload?.booking ?? {}

  const propriedade_id = booking.propriedade_id
  if (typeof propriedade_id !== 'string' || !UUID_RE.test(propriedade_id)) {
    return bad('propriedade_id obrigatório')
  }

  const nome = typeof guest.nome === 'string' ? guest.nome.trim() : ''
  if (!nome || nome.length > 200) return bad('Nome do hóspede obrigatório')

  const email = typeof guest.email === 'string' ? guest.email.trim() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 320) return bad('Email inválido')

  const check_in = booking.check_in
  const check_out = booking.check_out
  if (typeof check_in !== 'string' || !DATE_RE.test(check_in) ||
      typeof check_out !== 'string' || !DATE_RE.test(check_out) ||
      nights(check_in, check_out) < 1) {
    return bad('Datas inválidas')
  }
  if (check_in < today() || nights(check_in, check_out) > 365) {
    return bad('Datas inválidas')
  }

  const num_hospedes = Number(booking.num_hospedes ?? 1)
  if (!Number.isInteger(num_hospedes) || num_hospedes < 1 || num_hospedes > 50) {
    return bad('Número de hóspedes inválido')
  }

  const notas = typeof booking.notas === 'string' ? booking.notas.trim().slice(0, 2000) : undefined
  const telefone = typeof guest.telefone === 'string' ? guest.telefone.trim().slice(0, 40) : undefined

  const guestId = typeof guest.id === 'string' && UUID_RE.test(guest.id) ? guest.id : uuid()
  const bookingId = typeof booking.id === 'string' && UUID_RE.test(booking.id) ? booking.id : uuid()

  // Derive owner from the property
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propriedade_id as string)
    .single()

  if (propErr || !prop || prop.ativo === false) {
    return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 })
  }

  const owner_id = prop.owner_id as string | null

  // Disponibilidade verificada no servidor — o cliente pode contornar o calendário
  const { data: conflicts, error: cErr } = await supabase
    .from('bookings')
    .select('id')
    .eq('propriedade_id', propriedade_id as string)
    .not('estado', 'in', '("cancelada","no_show")')
    .lt('check_in', check_out)
    .gt('check_out', check_in)
    .limit(1)

  if (cErr) {
    console.error('[POST /api/book] conflict check', cErr.message)
    return NextResponse.json({ error: 'Erro ao verificar disponibilidade.' }, { status: 500 })
  }
  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'Estas datas já não estão disponíveis.' }, { status: 409 })
  }

  // Preço calculado no servidor — nunca confiar no valor enviado pelo cliente
  const [rules, tarifas, rates] = await Promise.all([
    adminGetPriceRules(owner_id ?? undefined),
    adminGetTarifas(owner_id ?? undefined),
    adminGetPlatformRates(owner_id ?? undefined),
  ])
  const preco_total = calculatePriceWithRules(prop as Property, check_in, check_out, rules, tarifas, rates, 'direto').total

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

  // Notificação por email server-side — falha não bloqueia a reserva
  try {
    await sendBookingNotification({
      bookingId,
      ownerId: owner_id,
      guestName: nome,
      guestEmail: email,
      guestPhone: telefone ?? null,
      propertyName: (prop.nome as string) ?? 'Propriedade',
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
