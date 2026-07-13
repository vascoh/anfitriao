import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendCheckinCompleteNotification } from '@/lib/notify-checkin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
const supabase = createAdminClient()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Campo de texto opcional: trim + limite de tamanho; null se vazio/inválido */
function optText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

function optDate(v: unknown): string | null {
  const s = optText(v, 10)
  return s && DATE_RE.test(s) ? s : null
}

type Params = Promise<{ bookingId: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { bookingId } = await params

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, num_hospedes, estado, hospede_id, propriedade_id, historico')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
  }

  if (booking.estado === 'cancelada') {
    return NextResponse.json({ error: 'Esta reserva foi cancelada' }, { status: 410 })
  }

  const [propRes, guestRes] = await Promise.all([
    supabase.from('properties').select('nome, cidade, imagem_url, owner_id').eq('id', booking.propriedade_id).single(),
    booking.hospede_id
      ? supabase.from('guests').select('nome, email, telefone, nacionalidade, numero_documento, data_nascimento, tipo_documento, sexo, pais_emissao, data_validade_doc').eq('id', booking.hospede_id).single()
      : Promise.resolve({ data: null }),
  ])

  const settingsRes = propRes.data?.owner_id
    ? await supabase.from('website_settings').select('host_nome, logo_texto').eq('owner_id', propRes.data.owner_id).maybeSingle()
    : { data: null }

  const historico: Array<{ tipo: string; descricao: string }> = Array.isArray(booking.historico) ? booking.historico : []
  const jaSubmetido = historico.some(e => e.tipo === 'checkin_online')

  return NextResponse.json({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    num_hospedes: booking.num_hospedes,
    estado: booking.estado,
    hospede_id: booking.hospede_id,
    property: propRes.data ?? null,
    host_nome: settingsRes.data?.host_nome ?? settingsRes.data?.logo_texto ?? 'O seu anfitrião',
    guest: guestRes.data ?? null,
    ja_submetido: jaSubmetido,
  })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { bookingId } = await params

  const rl = checkRateLimit(`checkin:${getClientIp(req)}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tenta mais tarde.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const nome = optText(body?.nome, 200)
  if (!nome) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, hospede_id, historico')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
  }

  const guestData = {
    nome,
    email: optText(body.email, 320),
    telefone: optText(body.telefone, 40),
    nacionalidade: optText(body.nacionalidade, 80),
    numero_documento: optText(body.numero_documento, 60),
    data_nascimento: optDate(body.data_nascimento),
    tipo_documento: optText(body.tipo_documento, 40),
    sexo: optText(body.sexo, 12),
    pais_emissao: optText(body.pais_emissao, 80),
    data_validade_doc: optDate(body.data_validade_doc),
  }

  if (booking.hospede_id) {
    await supabase.from('guests').update(guestData).eq('id', booking.hospede_id)
  }

  const now = new Date().toISOString()
  const historico: unknown[] = Array.isArray(booking.historico) ? booking.historico : []
  await supabase.from('bookings').update({
    historico: [...historico, {
      id: crypto.randomUUID(),
      data: now,
      tipo: 'checkin_online',
      descricao: `Check-in online submetido por ${guestData.nome}`,
    }],
  }).eq('id', bookingId)

  // Notificar o anfitrião — nunca bloquear o hóspede se o email falhar
  try {
    await sendCheckinCompleteNotification(bookingId)
  } catch (err) {
    console.error('[checkin] notify', err)
  }

  return NextResponse.json({ ok: true })
}
