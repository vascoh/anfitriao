import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

  const [propRes, settingsRes, guestRes] = await Promise.all([
    supabase.from('properties').select('nome, cidade, imagem_url').eq('id', booking.propriedade_id).single(),
    supabase.from('website_settings').select('host_nome, logo_texto').eq('id', 1).single(),
    booking.hospede_id
      ? supabase.from('guests').select('nome, email, telefone, nacionalidade, numero_documento, data_nascimento, tipo_documento, sexo, pais_emissao, data_validade_doc').eq('id', booking.hospede_id).single()
      : Promise.resolve({ data: null }),
  ])

  const historico: Array<{ tipo: string; descricao: string }> = Array.isArray(booking.historico) ? booking.historico : []
  const jaSubmetido = historico.some(e => e.tipo === 'nota' && e.descricao?.includes('Check-in online submetido'))

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

  const body = await req.json().catch(() => null)
  if (!body || !body.nome?.trim()) {
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
    nome: body.nome.trim(),
    email: body.email?.trim() || null,
    telefone: body.telefone?.trim() || null,
    nacionalidade: body.nacionalidade?.trim() || null,
    numero_documento: body.numero_documento?.trim() || null,
    data_nascimento: body.data_nascimento?.trim() || null,
    tipo_documento: body.tipo_documento?.trim() || null,
    sexo: body.sexo?.trim() || null,
    pais_emissao: body.pais_emissao?.trim() || null,
    data_validade_doc: body.data_validade_doc?.trim() || null,
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
      tipo: 'nota',
      descricao: `Check-in online submetido por ${guestData.nome}`,
    }],
  }).eq('id', bookingId)

  return NextResponse.json({ ok: true })
}
