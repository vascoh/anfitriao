import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  getInvoicingAdapter, isFaturacaoConfigurada, decomporReserva, pedidoDaReserva,
} from '@/lib/faturacao'
import { regraPara, calcularTmt } from '@/lib/taxa-turistica'
import type { Booking, Property, Guest } from '@/lib/types'

const supabase = createAdminClient()

/**
 * POST /api/faturas — emite a fatura-recibo de uma reserva.
 *
 * Regras de segurança do fluxo:
 * - Só o dono da reserva pode emitir.
 * - Uma reserva já faturada nunca é faturada outra vez: uma fatura emitida é
 *   um documento legal com numeração sequencial e só se anula por nota de
 *   crédito, não por reemissão.
 * - O estado passa a `a_emitir` **antes** da chamada ao fornecedor e só volta
 *   atrás em caso de falha, para dois pedidos simultâneos não emitirem dois
 *   documentos.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`faturas:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })
  }

  if (!isFaturacaoConfigurada()) {
    return NextResponse.json(
      { error: 'Faturação não configurada. Liga a tua conta de faturação certificada nas definições.' },
      { status: 501 },
    )
  }

  const body = await req.json().catch(() => null)
  const bookingId = body && typeof body.bookingId === 'string' ? body.bookingId : ''
  if (!bookingId) return NextResponse.json({ error: 'bookingId em falta' }, { status: 400 })

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
  if (booking.owner_id !== null && booking.owner_id !== userId) {
    return NextResponse.json({ error: 'Sem permissão para esta reserva.' }, { status: 403 })
  }

  const b = booking as Booking
  if (b.fatura_estado === 'emitida') {
    return NextResponse.json(
      { error: 'Esta reserva já tem fatura emitida. Para a anular, emite uma nota de crédito no teu programa de faturação.' },
      { status: 409 },
    )
  }
  if (b.fatura_estado === 'a_emitir') {
    return NextResponse.json({ error: 'Já está a ser emitida. Aguarda.' }, { status: 409 })
  }
  if (b.estado === 'cancelada' || b.estado === 'no_show') {
    return NextResponse.json({ error: 'Não se emite fatura de uma reserva cancelada.' }, { status: 400 })
  }

  const { data: propriedade } = await supabase
    .from('properties')
    .select('*')
    .eq('id', b.propriedade_id)
    .maybeSingle()

  if (!propriedade) return NextResponse.json({ error: 'Alojamento não encontrado' }, { status: 404 })

  const { data: hospede } = b.hospede_id
    ? await supabase.from('guests').select('*').eq('id', b.hospede_id).maybeSingle()
    : { data: null }

  // Marca antes de chamar o fornecedor: protege de emissão dupla
  const { data: reservado } = await supabase
    .from('bookings')
    .update({ fatura_estado: 'a_emitir', fatura_erro: null })
    .eq('id', bookingId)
    .eq('fatura_estado', b.fatura_estado)
    .select('id')
    .maybeSingle()

  if (!reservado) {
    return NextResponse.json({ error: 'Outro pedido está a emitir esta fatura.' }, { status: 409 })
  }

  const prop = propriedade as Property
  const regra = regraPara(prop.cidade)
  const taxaTuristica = regra ? calcularTmt(b, regra).valor : 0

  const componentes = decomporReserva(b.preco_total, {
    limpeza: prop.taxa_limpeza ?? 0,
    taxaTuristica,
  })

  const resultado = await getInvoicingAdapter().emitir(
    pedidoDaReserva(b, prop, hospede as Guest | null, componentes),
  )

  if (!resultado.sucesso) {
    await supabase
      .from('bookings')
      .update({ fatura_estado: 'falhou', fatura_erro: resultado.erro ?? 'Erro desconhecido' })
      .eq('id', bookingId)
    return NextResponse.json({ error: resultado.erro }, { status: 502 })
  }

  const { data: atualizada } = await supabase
    .from('bookings')
    .update({
      fatura_estado: 'emitida',
      fatura_id_externo: resultado.idExterno,
      fatura_numero: resultado.numero,
      fatura_atcud: resultado.atcud,
      fatura_url: resultado.urlPdf,
      fatura_total: resultado.total,
      fatura_emitida_em: new Date().toISOString(),
      fatura_erro: null,
    })
    .eq('id', bookingId)
    .select()
    .maybeSingle()

  await logAudit({
    actorId: userId,
    entidade: 'booking',
    entidadeId: bookingId,
    acao: 'fatura_emitida',
    detalhes: { numero: resultado.numero, atcud: resultado.atcud, total: resultado.total },
  })

  return NextResponse.json(atualizada)
}
