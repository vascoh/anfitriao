import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { eCanal, normalizarContacto, type Mensagem } from '@/lib/mensagens'
import { construirPedidoSugestao, ESQUEMA_SUGESTAO, SISTEMA_SUGESTAO, MAX_MENSAGENS_CONTEXTO } from '@/lib/sugestao-resposta'
import { today } from '@/lib/utils'
import type { Booking, Guest, Property, WebsiteSettings } from '@/lib/types'

/**
 * POST /api/mensagens/sugerir — rascunho da próxima resposta ao hóspede.
 *
 * Nunca envia: devolve texto para o anfitrião rever no compositor. O modelo
 * lê a conversa e os dados do alojamento e da reserva (ver
 * `lib/sugestao-resposta.ts` para o que entra e o que fica de fora).
 */

const client = new Anthropic()
const supabase = createAdminClient()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = await verificarLimite(`sugerir:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
    })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  const instrucao = typeof body.instrucao === 'string' ? body.instrucao.slice(0, 1000) : null

  let reserva: Booking | null = null
  let mensagensQ = supabase.from('mensagens').select('*').eq('owner_id', userId)

  if (typeof body.reserva_id === 'string' && body.reserva_id) {
    const { data } = await supabase.from('bookings').select('*').eq('id', body.reserva_id).eq('owner_id', userId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 })
    reserva = data as Booking
    mensagensQ = mensagensQ.eq('reserva_id', reserva.id)
  } else {
    const canal = body.canal
    const contacto = eCanal(canal) && typeof body.contacto === 'string' ? normalizarContacto(canal, body.contacto) : null
    if (!contacto || !eCanal(canal)) return NextResponse.json({ error: 'Falta a conversa.' }, { status: 400 })
    mensagensQ = mensagensQ.is('reserva_id', null).eq('canal', canal).eq('contacto', contacto)
  }

  const [{ data: msgs, error: erroMsgs }, hospedeR, alojamentoR, siteR] = await Promise.all([
    mensagensQ.order('criado_em', { ascending: false }).limit(MAX_MENSAGENS_CONTEXTO),
    reserva?.hospede_id
      ? supabase.from('guests').select('id, nome, nacionalidade, tags, criado_em').eq('id', reserva.hospede_id).eq('owner_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    reserva?.propriedade_id
      ? supabase.from('properties').select('id, nome, cidade, endereco, capacidade, comodidades, instrucoes_checkin, regras_casa').eq('id', reserva.propriedade_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('website_settings').select('nome, host_nome, telefone, idioma').eq('owner_id', userId).maybeSingle(),
  ])
  if (erroMsgs) return NextResponse.json({ error: 'Não foi possível ler a conversa.' }, { status: 500 })

  const pedido = construirPedidoSugestao({
    reserva,
    hospede: (hospedeR.data as Guest | null) ?? null,
    alojamento: (alojamentoR.data as Property | null) ?? null,
    site: (siteR.data as Pick<WebsiteSettings, 'nome' | 'host_nome' | 'telefone' | 'idioma'> | null) ?? null,
    mensagens: (msgs ?? []) as Mensagem[],
    instrucao,
    hoje: today(),
  })

  try {
    const resposta = await client.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      system: SISTEMA_SUGESTAO,
      messages: [{ role: 'user', content: pedido }],
      output_config: {
        effort: 'low',
        format: jsonSchemaOutputFormat(ESQUEMA_SUGESTAO),
      },
    }, { signal: req.signal })

    console.info('[sugerir] uso', JSON.stringify({
      userId,
      entrada: resposta.usage.input_tokens,
      saida: resposta.usage.output_tokens,
    }))

    if (resposta.stop_reason === 'refusal' || !resposta.parsed_output) {
      return NextResponse.json({ error: 'Não foi possível sugerir uma resposta para esta conversa.' }, { status: 502 })
    }
    const { resposta: texto, lingua, precisa_confirmar } = resposta.parsed_output
    if (!texto.trim()) return NextResponse.json({ error: 'A sugestão veio vazia. Tenta outra vez.' }, { status: 502 })
    return NextResponse.json({
      resposta: texto.trim(),
      lingua: lingua.slice(0, 8),
      precisa_confirmar: precisa_confirmar.slice(0, 10),
    })
  } catch (err) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 })
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'O serviço de IA está ocupado. Tenta daqui a pouco.' }, { status: 503 })
    }
    console.error('[sugerir] falhou', userId, err)
    return NextResponse.json({ error: 'Não foi possível sugerir uma resposta. Tenta outra vez.' }, { status: 502 })
  }
}
