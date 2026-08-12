import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendCheckinCompleteNotification } from '@/lib/notify-checkin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { protegerCampos, revelarCampos, revelarLista } from '@/lib/campos-sensiveis'
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

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { bookingId } = await params

  // Devolve PII do hóspede — limitar tentativas de enumeração de bookingIds
  const rl = checkRateLimit(`checkin-get:${getClientIp(req)}`, 60, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tenta mais tarde.' }, { status: 429 })
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, num_hospedes, estado, hospede_id, propriedade_id, historico, reserva_grupo_id')
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
      ? supabase.from('guests').select('nome, email, telefone, nacionalidade, numero_documento, data_nascimento, tipo_documento, sexo, pais_emissao, data_validade_doc, pais_residencia, local_residencia, nif').eq('id', booking.hospede_id).single()
      : Promise.resolve({ data: null }),
  ])

  const settingsRes = propRes.data?.owner_id
    ? await supabase.from('website_settings').select('host_nome, logo_texto').eq('owner_id', propRes.data.owner_id).maybeSingle()
    : { data: null }

  // Acompanhantes já registados, para reabrir o formulário sem perder o que
  // já foi preenchido.
  const { data: ligacoes } = await supabase
    .from('reserva_hospedes')
    .select('guest_id, principal')
    .eq('booking_id', bookingId)

  const idsAcompanhantes = (ligacoes ?? [])
    .filter(l => !l.principal && l.guest_id !== booking.hospede_id)
    .map(l => l.guest_id as string)

  const { data: acompanhantes } = idsAcompanhantes.length > 0
    ? await supabase.from('guests')
        .select('id, nome, data_nascimento, nacionalidade, numero_documento, tipo_documento, sexo, pais_emissao, pais_residencia, local_residencia')
        .in('id', idsAcompanhantes)
    : { data: [] }

  const historico: Array<{ tipo: string; descricao: string }> = Array.isArray(booking.historico) ? booking.historico : []
  const jaSubmetido = historico.some(e => e.tipo === 'checkin_online')

  return NextResponse.json({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    num_hospedes: booking.num_hospedes,
    estado: booking.estado,
    hospede_id: booking.hospede_id,
    /* Quem reservou dorme neste quarto?
     *
     * Numa reserva normal, sim — é a pessoa que está a fazer o check-in. Num
     * grupo, `hospede_id` é o mesmo em todos os quartos (é o contacto) mas a
     * pessoa só ocupa um deles. Sem esta distinção o formulário do segundo
     * quarto pedia menos uma ficha do que as pessoas que lá dormem, e a
     * reserva dava-se por completa com alguém por comunicar. */
    principal_neste_quarto: booking.reserva_grupo_id
      ? (ligacoes ?? []).some(l => l.principal && l.guest_id === booking.hospede_id)
      : true,
    property: propRes.data ?? null,
    host_nome: settingsRes.data?.host_nome ?? settingsRes.data?.logo_texto ?? 'O seu anfitrião',
    // O hóspede é o titular destes dados: vê-os em claro para poder corrigi-los.
    guest: revelarCampos(guestRes.data ?? null),
    acompanhantes: revelarLista(acompanhantes),
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
    .select('id, hospede_id, historico, owner_id, num_hospedes, reserva_grupo_id')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
  }

  const guestDataEmClaro = {
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
    // Exigidos pelo boletim de alojamento: sem o país de residência nenhum
    // boletim pode ser entregue ao SIBA, por muito completo que esteja o resto.
    pais_residencia: optText(body.pais_residencia, 80),
    local_residencia: optText(body.local_residencia, 120),
    /* NIF ≠ número do documento. Campo próprio, opcional: sem ele a fatura
     * sai a "Consumidor final". Antes o Cartão de Cidadão ia parar ao campo
     * do NIF na fatura comunicada à AT. */
    nif: optText(body.nif, 20),
  }

  /* Campos de documento encriptados antes de tocar na base (ANF-1.7). Em
   * produção sem chave isto lança, e o check-in falha — é preferível ao
   * número de documento ficar em claro sem ninguém dar por isso. */
  let guestData: Record<string, unknown>
  try {
    guestData = protegerCampos(guestDataEmClaro)
  } catch (err) {
    console.error('[checkin] encriptação', err)
    return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
  }

  // Propagar erros de escrita: sem isto o hóspede via "Obrigado" mesmo quando
  // o RLS/BD rejeitava os updates e nada ficava gravado (perda de dados silenciosa)
  if (booking.hospede_id) {
    const { error: gErr } = await supabase.from('guests').update(guestData).eq('id', booking.hospede_id)
    if (gErr) {
      console.error('[checkin] guest update', gErr.message)
      return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
    }
    /* Rede de segurança para reservas anteriores à 036 — mas **não** em grupo.
     *
     * Num grupo, `bookings.hospede_id` é o mesmo em todos os quartos (é o
     * contacto), e `reserva_hospedes` é quem dorme onde. Ligar aqui punha
     * quem reservou como ocupante de todos os quartos em que fizesse
     * check-in: a mesma pessoa declarada N vezes ao SIBA, e as reservas a
     * darem-se por completas sem os acompanhantes. A ligação do grupo é feita
     * uma única vez, na criação, ao primeiro quarto. */
    if (!booking.reserva_grupo_id) {
      await supabase.from('reserva_hospedes').upsert(
        { booking_id: bookingId, guest_id: booking.hospede_id, principal: true, owner_id: booking.owner_id },
        { onConflict: 'booking_id,guest_id' },
      )
    }
  }

  /* Acompanhantes.
   *
   * O boletim de alojamento é por pessoa: sem isto, uma reserva de 8 comunica
   * uma e deixa sete por comunicar. Cada acompanhante é uma ficha de hóspede
   * própria, ligada à reserva.
   *
   * Guardam-se apenas os que têm nome — uma linha em branco é alguém que
   * começou a preencher e desistiu, e criar-lhe uma ficha vazia só dá
   * trabalho a limpar depois. */
  const acompanhantes = Array.isArray(body?.acompanhantes) ? body.acompanhantes.slice(0, 30) : []

  for (const a of acompanhantes) {
    const nomeAcomp = optText(a?.nome, 200)
    if (!nomeAcomp) continue

    const dadosEmClaro = {
      nome: nomeAcomp,
      nacionalidade: optText(a?.nacionalidade, 80),
      numero_documento: optText(a?.numero_documento, 60),
      data_nascimento: optDate(a?.data_nascimento),
      tipo_documento: optText(a?.tipo_documento, 40),
      sexo: optText(a?.sexo, 12),
      pais_emissao: optText(a?.pais_emissao, 80),
      pais_residencia: optText(a?.pais_residencia, 80),
      local_residencia: optText(a?.local_residencia, 120),
      owner_id: booking.owner_id,
    }

    let dados: Record<string, unknown>
    try {
      dados = protegerCampos(dadosEmClaro)
    } catch (err) {
      console.error('[checkin] encriptação acompanhante', err)
      return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
    }

    // Reenviar o formulário atualiza a mesma ficha em vez de criar outra.
    const idExistente = typeof a?.id === 'string' && a.id ? a.id : null

    if (idExistente) {
      const { error } = await supabase.from('guests').update(dados).eq('id', idExistente)
      if (error) {
        console.error('[checkin] acompanhante update', error.message)
        return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
      }
      await supabase.from('reserva_hospedes').upsert(
        { booking_id: bookingId, guest_id: idExistente, principal: false, owner_id: booking.owner_id },
        { onConflict: 'booking_id,guest_id' },
      )
      continue
    }

    const novoId = crypto.randomUUID()
    const { error } = await supabase.from('guests').insert({
      id: novoId, ...dados, tags: ['novo'], criado_em: new Date().toISOString(),
    })
    if (error) {
      console.error('[checkin] acompanhante insert', error.message)
      return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
    }
    await supabase.from('reserva_hospedes').insert({
      booking_id: bookingId, guest_id: novoId, principal: false, owner_id: booking.owner_id,
    })
  }

  const now = new Date().toISOString()
  const historico: unknown[] = Array.isArray(booking.historico) ? booking.historico : []
  const { error: bErr } = await supabase.from('bookings').update({
    historico: [...historico, {
      id: crypto.randomUUID(),
      data: now,
      tipo: 'checkin_online',
      descricao: `Check-in online submetido por ${guestDataEmClaro.nome}`,
    }],
  }).eq('id', bookingId)
  if (bErr) {
    console.error('[checkin] booking update', bErr.message)
    return NextResponse.json({ error: 'Não foi possível guardar os dados. Tenta novamente.' }, { status: 500 })
  }

  // Notificar o anfitrião — nunca bloquear o hóspede se o email falhar
  try {
    await sendCheckinCompleteNotification(bookingId)
  } catch (err) {
    console.error('[checkin] notify', err)
  }

  return NextResponse.json({ ok: true })
}
