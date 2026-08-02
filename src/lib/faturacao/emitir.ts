import 'server-only'
import { createAdminClient } from '../supabase'
import { regraPara, calcularTmt } from '../taxa-turistica'
import { getInvoicingAdapter } from './index'
import { contaComCredenciais, contaPronta, type ContaFaturacao } from './contas'
import { decomporReserva, pedidoDaReserva, pedidoDaNotaCredito } from './mapping'
import type { CredenciaisConta } from './types'
import type { Booking, Property, Guest } from '../types'

/**
 * Emissão de faturas a partir de reservas.
 *
 * Vive aqui, e não na rota, porque tem dois chamadores com direitos
 * diferentes: o anfitrião a carregar num botão e o cron do checkout a emitir
 * sozinho. A regra "uma reserva, uma fatura" tem de valer para os dois, e
 * duplicar a lógica seria duplicá-la mal.
 */

export type MotivoFalha =
  | 'sem_conta' | 'conta_incompleta' | 'ja_emitida' | 'a_emitir'
  | 'cancelada' | 'sem_valor' | 'nao_encontrada' | 'sem_permissao' | 'fornecedor'

export interface FalhaEmissao {
  ok: false
  motivo: MotivoFalha
  erro: string
  estado: number
}

export interface SucessoEmissao {
  ok: true
  numero?: string
  atcud?: string
  url?: string
  total?: number
}

export type ResultadoEmissao = SucessoEmissao | FalhaEmissao

const MENSAGENS: Record<MotivoFalha, string> = {
  sem_conta: 'Ainda não tens faturação ligada.',
  conta_incompleta: 'A faturação ainda não está pronta: falta ligar as credenciais da AT.',
  ja_emitida: 'Esta reserva já tem fatura. Uma fatura emitida só se anula por nota de crédito.',
  a_emitir: 'Já está a ser emitida. Aguarda.',
  cancelada: 'Não se emite fatura de uma reserva cancelada.',
  sem_valor: 'A reserva não tem valor registado. Preenche o preço antes de faturar.',
  nao_encontrada: 'Reserva não encontrada.',
  sem_permissao: 'Sem permissão para esta reserva.',
  fornecedor: 'O fornecedor de faturação recusou o pedido.',
}

function falha(motivo: MotivoFalha, estado: number, erro?: string): FalhaEmissao {
  return { ok: false, motivo, estado, erro: erro ?? MENSAGENS[motivo] }
}

/**
 * Emite a fatura-recibo de uma reserva.
 *
 * A proteção contra emissão dupla é uma transição de estado condicionada
 * (`fatura_estado` só passa a `a_emitir` se ainda estiver no valor lido). Dois
 * pedidos em simultâneo — o botão e o cron, tipicamente — só deixam passar um.
 */
export async function emitirFaturaDaReserva(
  ownerId: string,
  bookingId: string,
): Promise<ResultadoEmissao> {
  const supabase = createAdminClient()

  const par = await contaComCredenciais(ownerId)
  if (!par) return falha('sem_conta', 409)
  if (!contaPronta(par.conta)) return falha('conta_incompleta', 409)

  const { data: booking } = await supabase
    .from('bookings').select('*').eq('id', bookingId).maybeSingle()

  if (!booking) return falha('nao_encontrada', 404)
  if (booking.owner_id !== null && booking.owner_id !== ownerId) return falha('sem_permissao', 403)

  const b = booking as Booking
  if (b.fatura_estado === 'emitida') return falha('ja_emitida', 409)
  if (b.fatura_estado === 'a_emitir') return falha('a_emitir', 409)
  if (b.estado === 'cancelada' || b.estado === 'no_show') return falha('cancelada', 400)
  if (!b.preco_total || b.preco_total <= 0) return falha('sem_valor', 400)

  const { data: propriedade } = await supabase
    .from('properties').select('*').eq('id', b.propriedade_id).maybeSingle()
  if (!propriedade) return falha('nao_encontrada', 404, 'Alojamento não encontrado.')

  const { data: hospede } = b.hospede_id
    ? await supabase.from('guests').select('*').eq('id', b.hospede_id).maybeSingle()
    : { data: null }

  // Reserva o direito de emitir antes de falar com o fornecedor.
  const { data: reservado } = await supabase
    .from('bookings')
    .update({ fatura_estado: 'a_emitir', fatura_erro: null })
    .eq('id', bookingId)
    .eq('fatura_estado', b.fatura_estado)
    .select('id')
    .maybeSingle()

  if (!reservado) return falha('a_emitir', 409)

  const prop = propriedade as Property
  const regra = regraPara(prop.cidade)
  const taxaTuristica = regra ? calcularTmt(b, regra).valor : 0

  const componentes = decomporReserva(b.preco_total, {
    limpeza: prop.taxa_limpeza ?? 0,
    taxaTuristica,
  })

  const resultado = await getInvoicingAdapter().emitir(
    par.credenciais,
    pedidoDaReserva(b, prop, hospede as Guest | null, componentes, { serieId: par.conta.serie_id }),
  )

  if (!resultado.sucesso) {
    await supabase
      .from('bookings')
      .update({ fatura_estado: 'falhou', fatura_erro: resultado.erro ?? 'Erro desconhecido' })
      .eq('id', bookingId)
    return falha('fornecedor', 502, resultado.erro)
  }

  await supabase
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

  return {
    ok: true,
    numero: resultado.numero,
    atcud: resultado.atcud,
    url: resultado.urlPdf,
    total: resultado.total,
  }
}

/**
 * Anula a fatura de uma reserva por nota de crédito.
 *
 * Não apaga nem reemite: a fatura já tem numeração sequencial comunicada à AT
 * e o único caminho legal para trás é um documento que a anule.
 */
export async function emitirNotaCredito(
  ownerId: string,
  bookingId: string,
  motivo?: string,
): Promise<ResultadoEmissao> {
  const supabase = createAdminClient()

  const par = await contaComCredenciais(ownerId)
  if (!par) return falha('sem_conta', 409)
  if (!contaPronta(par.conta)) return falha('conta_incompleta', 409)

  const { data: booking } = await supabase
    .from('bookings').select('*').eq('id', bookingId).maybeSingle()

  if (!booking) return falha('nao_encontrada', 404)
  if (booking.owner_id !== null && booking.owner_id !== ownerId) return falha('sem_permissao', 403)

  const b = booking as Booking
  if (b.fatura_estado !== 'emitida') {
    return falha('ja_emitida', 409, 'Esta reserva não tem fatura emitida para anular.')
  }
  if (b.nota_credito_id_externo) {
    return falha('ja_emitida', 409, 'Esta fatura já foi anulada por nota de crédito.')
  }

  const { data: propriedade } = await supabase
    .from('properties').select('*').eq('id', b.propriedade_id).maybeSingle()
  if (!propriedade) return falha('nao_encontrada', 404, 'Alojamento não encontrado.')

  const { data: hospede } = b.hospede_id
    ? await supabase.from('guests').select('*').eq('id', b.hospede_id).maybeSingle()
    : { data: null }

  const prop = propriedade as Property
  const regra = regraPara(prop.cidade)
  const taxaTuristica = regra ? calcularTmt(b, regra).valor : 0
  const componentes = decomporReserva(b.preco_total, {
    limpeza: prop.taxa_limpeza ?? 0,
    taxaTuristica,
  })

  const resultado = await getInvoicingAdapter().emitir(
    par.credenciais,
    pedidoDaNotaCredito(b, prop, hospede as Guest | null, componentes, {
      serieId: par.conta.serie_id,
      motivo,
    }),
  )

  if (!resultado.sucesso) return falha('fornecedor', 502, resultado.erro)

  await supabase
    .from('bookings')
    .update({
      nota_credito_id_externo: resultado.idExterno,
      nota_credito_numero: resultado.numero,
      nota_credito_emitida_em: new Date().toISOString(),
    })
    .eq('id', bookingId)

  return {
    ok: true,
    numero: resultado.numero,
    atcud: resultado.atcud,
    url: resultado.urlPdf,
    total: resultado.total,
  }
}

/** Credenciais + conta, para quem precisa de falar diretamente com o fornecedor. */
export async function contaAtivaDe(
  ownerId: string,
): Promise<{ conta: ContaFaturacao; credenciais: CredenciaisConta } | null> {
  return contaComCredenciais(ownerId)
}
