import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { emailService } from '@/lib/email'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import {
  agruparConversas, dentroDaJanelaWhatsApp, eCanal, enderecoEmail, linkWhatsApp, normalizarContacto, normalizarTelefone,
  CANAIS_DE_ENVIO, LIMITE_ASSUNTO, LIMITE_CORPO, type CanalMensagem, type Mensagem,
} from '@/lib/mensagens'
import {
  enderecoDeResposta, enviarWhatsAppApi, gravarMensagem, ligacaoWhatsAppDoDono, rececaoEmailAtiva,
} from '@/lib/mensagens-server'

/**
 * Caixa de entrada.
 *
 * GET                       → conversas (uma por reserva), com nomes já juntos
 * GET ?resumo=1             → { porLer } para o contador da navegação
 * GET ?reserva=<id>         → mensagens dessa reserva + o que se pode fazer nela
 * GET ?canal=&contacto=     → conversa sem reserva
 * POST                      → enviar (email, WhatsApp) ou registar (o resto)
 * PATCH { acao: 'lida' }    → marcar conversa como lida
 * PATCH { acao: 'associar'} → ligar uma conversa sem reserva a uma reserva
 */

const supabase = createAdminClient()
const LIMITE_LISTA = 2000

interface ReservaJunta {
  id: string
  check_in: string
  check_out: string
  estado: string
  propriedade_id: string | null
  hospede_id: string | null
}

async function reservaDoDono(id: string, ownerId: string) {
  const { data } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, estado, propriedade_id, hospede_id, owner_id')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data as (ReservaJunta & { owner_id: string }) | null
}

async function hospede(id: string | null, ownerId: string) {
  if (!id) return null
  const { data } = await supabase.from('guests').select('id, nome, email, telefone').eq('id', id).eq('owner_id', ownerId).maybeSingle()
  return data as { id: string; nome: string; email: string | null; telefone: string | null } | null
}

function threadQuery(ownerId: string) {
  return supabase.from('mensagens').select('*').eq('owner_id', ownerId).order('criado_em', { ascending: true }).limit(500)
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const p = req.nextUrl.searchParams

  if (p.get('resumo')) {
    const { count, error } = await supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('direcao', 'entrada')
      .is('lida_em', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ porLer: count ?? 0 })
  }

  const reservaId = p.get('reserva')
  const canal = p.get('canal')
  const contacto = p.get('contacto')

  if (reservaId || (canal && contacto)) {
    let q = threadQuery(userId)
    let reserva: ReservaJunta | null = null
    if (reservaId) {
      reserva = await reservaDoDono(reservaId, userId)
      if (!reserva) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 })
      q = q.eq('reserva_id', reservaId)
    } else {
      const c = eCanal(canal) ? normalizarContacto(canal, contacto) : null
      if (!c) return NextResponse.json({ error: 'Conversa inválida.' }, { status: 400 })
      q = q.is('reserva_id', null).eq('canal', canal).eq('contacto', c)
    }
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const mensagens = (data ?? []) as Mensagem[]
    const h = await hospede(reserva?.hospede_id ?? null, userId)
    const ligacao = await ligacaoWhatsAppDoDono(supabase, userId)
    const telefone = h?.telefone ?? (canal === 'whatsapp' ? contacto : null)
    const email = h?.email ?? (canal === 'email' ? contacto : null)
    let propriedade: string | null = null
    if (reserva?.propriedade_id) {
      const { data: prop } = await supabase.from('properties').select('nome').eq('id', reserva.propriedade_id).maybeSingle()
      propriedade = prop?.nome ?? null
    }
    return NextResponse.json({
      mensagens,
      reserva,
      propriedade,
      hospede: h ? { id: h.id, nome: h.nome } : null,
      contactos: { email, telefone: normalizarTelefone(telefone) },
      capacidades: {
        email: Boolean(email),
        whatsappApi: Boolean(ligacao && telefone),
        whatsappJanela: dentroDaJanelaWhatsApp(mensagens),
        whatsappLink: Boolean(normalizarTelefone(telefone)),
        respostasPorEmail: rececaoEmailAtiva(),
      },
    })
  }

  // Lista de conversas.
  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: false })
    .limit(LIMITE_LISTA)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const conversas = agruparConversas((data ?? []) as Mensagem[])

  const reservaIds = [...new Set(conversas.map(c => c.reserva_id).filter((x): x is string => Boolean(x)))]
  const reservas = new Map<string, ReservaJunta>()
  if (reservaIds.length) {
    const { data: rs } = await supabase
      .from('bookings')
      .select('id, check_in, check_out, estado, propriedade_id, hospede_id')
      .eq('owner_id', userId)
      .in('id', reservaIds)
    for (const r of (rs ?? []) as ReservaJunta[]) reservas.set(r.id, r)
  }
  const hospedeIds = [...new Set([
    ...conversas.map(c => c.hospede_id),
    ...[...reservas.values()].map(r => r.hospede_id),
  ].filter((x): x is string => Boolean(x)))]
  const nomes = new Map<string, string>()
  if (hospedeIds.length) {
    const { data: gs } = await supabase.from('guests').select('id, nome').eq('owner_id', userId).in('id', hospedeIds)
    for (const g of gs ?? []) nomes.set(g.id, g.nome)
  }
  const propIds = [...new Set([...reservas.values()].map(r => r.propriedade_id).filter((x): x is string => Boolean(x)))]
  const props = new Map<string, string>()
  if (propIds.length) {
    const { data: ps } = await supabase.from('properties').select('id, nome').eq('owner_id', userId).in('id', propIds)
    for (const pr of ps ?? []) props.set(pr.id, pr.nome)
  }

  return NextResponse.json(conversas.map(c => {
    const r = c.reserva_id ? reservas.get(c.reserva_id) ?? null : null
    const hid = r?.hospede_id ?? c.hospede_id
    return {
      ...c,
      ultima: { ...c.ultima, corpo: c.ultima.corpo.slice(0, 240) },
      nome: (hid && nomes.get(hid)) || c.nome_contacto || c.contacto || 'Sem nome',
      propriedade: r?.propriedade_id ? props.get(r.propriedade_id) ?? null : null,
      check_in: r?.check_in ?? null,
      check_out: r?.check_out ?? null,
    }
  }))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Envia email e WhatsApp em nome do anfitrião: um teto evita que um script
  // (ou um botão preso) despeje mensagens sobre os hóspedes.
  const rl = await verificarLimite(`mensagens-envio:${userId}`, 30, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiadas mensagens seguidas. Aguarda um momento.' }, { status: 429 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const canal = body.canal
  if (!eCanal(canal)) return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 })
  const direcao = body.direcao === 'entrada' ? 'entrada' : 'saida'
  const corpo = typeof body.corpo === 'string' ? body.corpo.trim() : ''
  if (!corpo) return NextResponse.json({ error: 'A mensagem está vazia.' }, { status: 400 })
  if (corpo.length > LIMITE_CORPO) return NextResponse.json({ error: 'A mensagem é demasiado longa.' }, { status: 400 })
  const assunto = typeof body.assunto === 'string' ? body.assunto.trim().slice(0, LIMITE_ASSUNTO) || null : null
  const sugeridaPorIa = body.sugerida_por_ia === true
  const modo = body.modo === 'link' ? 'link' : 'auto'

  let reserva: (ReservaJunta & { owner_id: string }) | null = null
  if (typeof body.reserva_id === 'string' && body.reserva_id) {
    reserva = await reservaDoDono(body.reserva_id, userId)
    if (!reserva) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 })
  }
  const contactoBruto = typeof body.contacto === 'string' ? normalizarContacto(canal, body.contacto) : null
  if (!reserva && !contactoBruto) {
    return NextResponse.json({ error: 'Falta a reserva ou o contacto.' }, { status: 400 })
  }
  const h = await hospede(reserva?.hospede_id ?? null, userId)

  const base = {
    owner_id: userId,
    reserva_id: reserva?.id ?? null,
    hospede_id: h?.id ?? null,
    canal: canal as CanalMensagem,
    direcao,
    corpo,
    assunto,
    sugerida_por_ia: sugeridaPorIa,
  } as const

  // Colar uma mensagem que chegou noutro sítio, ou registar o que se enviou
  // por um canal que a aplicação não fala (Airbnb, Booking.com, SMS, …).
  if (direcao === 'entrada' || body.registo === true || !CANAIS_DE_ENVIO.includes(canal)) {
    const r = await gravarMensagem(supabase, {
      ...base,
      estado: 'registada',
      contacto: contactoBruto,
      lida_em: new Date().toISOString(),
    })
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 500 })
    return NextResponse.json({ mensagem: r.mensagem })
  }

  if (canal === 'email') {
    const para = enderecoEmail(h?.email ?? contactoBruto)
    if (!para) return NextResponse.json({ error: 'O hóspede não tem email válido.' }, { status: 400 })
    let nomeAlojamento = ''
    if (reserva?.propriedade_id) {
      const { data: prop } = await supabase.from('properties').select('nome').eq('id', reserva.propriedade_id).maybeSingle()
      nomeAlojamento = prop?.nome ?? ''
    }
    const assuntoFinal = assunto ?? (nomeAlojamento ? `A sua estadia em ${nomeAlojamento}` : 'A sua estadia')
    const envio = await emailService.sendGuestMessage({
      ownerId: userId,
      guestEmail: para,
      subject: assuntoFinal,
      mensagem: corpo,
      replyTo: reserva ? enderecoDeResposta(reserva.id) : null,
    })
    const r = await gravarMensagem(supabase, {
      ...base,
      assunto: assuntoFinal,
      contacto: para,
      estado: envio.ok ? 'enviada' : 'falhou',
      id_externo: envio.ok ? envio.id ?? null : null,
      erro: envio.ok ? null : envio.error === 'no_api_key' ? 'O envio de email não está configurado.' : envio.error ?? 'Falha no envio.',
    })
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 500 })
    if (!envio.ok) return NextResponse.json({ error: r.mensagem?.erro ?? 'Falha no envio.', mensagem: r.mensagem }, { status: 502 })
    return NextResponse.json({ mensagem: r.mensagem })
  }

  // WhatsApp
  const telefone = normalizarTelefone(h?.telefone ?? contactoBruto)
  if (!telefone) return NextResponse.json({ error: 'O hóspede não tem telefone válido.' }, { status: 400 })

  const ligacao = modo === 'auto' ? await ligacaoWhatsAppDoDono(supabase, userId) : null
  if (ligacao) {
    let q = supabase.from('mensagens').select('canal, direcao, criado_em').eq('owner_id', userId).eq('canal', 'whatsapp').eq('direcao', 'entrada')
    q = reserva ? q.eq('reserva_id', reserva.id) : q.eq('contacto', telefone)
    const { data: recentes } = await q.order('criado_em', { ascending: false }).limit(1)
    if (dentroDaJanelaWhatsApp((recentes ?? []) as Pick<Mensagem, 'canal' | 'direcao' | 'criado_em'>[])) {
      const envio = await enviarWhatsAppApi(ligacao, telefone, corpo)
      const r = await gravarMensagem(supabase, {
        ...base,
        contacto: telefone,
        estado: envio.ok ? 'enviada' : 'falhou',
        id_externo: envio.ok ? envio.id : null,
        erro: envio.ok ? null : envio.erro,
      })
      if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 500 })
      if (!envio.ok) {
        return NextResponse.json({ error: envio.erro, mensagem: r.mensagem, link: linkWhatsApp(telefone, corpo) }, { status: 502 })
      }
      return NextResponse.json({ mensagem: r.mensagem })
    }
  }

  // Sem API (ou fora da janela de 24 h): abre-se o WhatsApp do telemóvel com
  // o texto escrito, e a mensagem fica no histórico como «aberta no WhatsApp».
  const r = await gravarMensagem(supabase, { ...base, contacto: telefone, estado: 'registada' })
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 500 })
  return NextResponse.json({ mensagem: r.mensagem, link: linkWhatsApp(telefone, corpo) })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const reservaId = typeof body.reserva_id === 'string' ? body.reserva_id : null
  const canal = body.canal
  const contacto = eCanal(canal) && typeof body.contacto === 'string' ? normalizarContacto(canal, body.contacto) : null

  if (body.acao === 'lida') {
    let q = supabase.from('mensagens').update({ lida_em: new Date().toISOString() })
      .eq('owner_id', userId).eq('direcao', 'entrada').is('lida_em', null)
    if (reservaId) q = q.eq('reserva_id', reservaId)
    else if (eCanal(canal) && contacto) q = q.is('reserva_id', null).eq('canal', canal).eq('contacto', contacto)
    else return NextResponse.json({ error: 'Falta a conversa.' }, { status: 400 })
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.acao === 'associar') {
    if (!reservaId || !eCanal(canal) || !contacto) return NextResponse.json({ error: 'Faltam dados.' }, { status: 400 })
    const reserva = await reservaDoDono(reservaId, userId)
    if (!reserva) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 })
    const { error } = await supabase.from('mensagens')
      .update({ reserva_id: reserva.id, hospede_id: reserva.hospede_id })
      .eq('owner_id', userId).is('reserva_id', null).eq('canal', canal).eq('contacto', contacto)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
}
