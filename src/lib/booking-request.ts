import 'server-only'
import { createAdminClient } from './supabase'
import { uuid, nights, today } from './utils'
import { calculatePriceWithRules } from './reservations'
import { adminGetPriceRules, adminGetTarifas, adminGetPlatformRates } from './db-admin'
import { ehCasaComQuartos } from './ownership'
import { verificarDisponibilidadeAoVivo, mensagemAoVivo } from './disponibilidade-ao-vivo'
import type { Property } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ValidatedBookingRequest {
  guestId: string
  bookingId: string
  nome: string
  email: string
  telefone?: string
  notas?: string
  propriedade_id: string
  check_in: string
  check_out: string
  num_hospedes: number
  owner_id: string | null
  preco_total: number
  prop: Property & { nome: string; owner_id: string | null }
}

export type ValidationResult =
  | { ok: true; data: ValidatedBookingRequest }
  | { ok: false; error: string; status: number }

/**
 * Validação + preço + conflito de datas partilhados entre o fluxo de pedido
 * sem pagamento (/api/book) e o fluxo de checkout pago (/api/book/checkout).
 * Não insere nada na BD — quem chama decide o que fazer com o resultado
 * (inserir logo como pendente, ou só depois de o pagamento ser confirmado).
 */
export async function validateBookingRequest(
  payload: { guest?: Record<string, unknown>; booking?: Record<string, unknown> },
): Promise<ValidationResult> {
  const supabase = createAdminClient()
  const guest = payload?.guest ?? {}
  const booking = payload?.booking ?? {}

  const propriedade_id = booking.propriedade_id
  if (typeof propriedade_id !== 'string' || !UUID_RE.test(propriedade_id)) {
    return { ok: false, error: 'propriedade_id obrigatório', status: 400 }
  }

  const nome = typeof guest.nome === 'string' ? guest.nome.trim() : ''
  if (!nome || nome.length > 200) return { ok: false, error: 'Nome do hóspede obrigatório', status: 400 }

  const email = typeof guest.email === 'string' ? guest.email.trim() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 320) return { ok: false, error: 'Email inválido', status: 400 }

  const check_in = booking.check_in
  const check_out = booking.check_out
  if (typeof check_in !== 'string' || !DATE_RE.test(check_in) ||
      typeof check_out !== 'string' || !DATE_RE.test(check_out) ||
      nights(check_in, check_out) < 1) {
    return { ok: false, error: 'Datas inválidas', status: 400 }
  }
  if (check_in < today() || nights(check_in, check_out) > 365) {
    return { ok: false, error: 'Datas inválidas', status: 400 }
  }

  const num_hospedes = Number(booking.num_hospedes ?? 1)
  if (!Number.isInteger(num_hospedes) || num_hospedes < 1 || num_hospedes > 50) {
    return { ok: false, error: 'Número de hóspedes inválido', status: 400 }
  }

  const notas = typeof booking.notas === 'string' ? booking.notas.trim().slice(0, 2000) : undefined
  const telefone = typeof guest.telefone === 'string' ? guest.telefone.trim().slice(0, 40) : undefined

  /* Os ids são do servidor, sempre.
   *
   * Aceitava-se o id que o browser mandasse, e isso deixava um visitante
   * escolher a chave primária de linhas que a app depois escreve. O caminho
   * pago é o pior: `fulfillCheckoutSession` faz `upsert` do hóspede, portanto
   * quem soubesse o id de uma ficha — o `hospede_id` vai no payload do
   * check-in, e o link do check-in anda por email — reescrevia-a com o nome e
   * o email dele, e mudava-lhe o dono. Não há razão nenhuma para o lado
   * público escolher ids: quem precisa deles recebe-os na resposta. */
  const guestId = uuid()
  const bookingId = uuid()

  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propriedade_id)
    .single()

  if (propErr || !prop || prop.ativo === false) {
    return { ok: false, error: 'Propriedade não encontrada', status: 404 }
  }

  const owner_id = prop.owner_id as string | null

  /* Uma casa com quartos não se reserva por inteiro por este caminho — para
   * isso existe `/api/book/grupo`, que reserva os quartos todos. Ver
   * `ehCasaComQuartos`: sem isto ficava uma reserva que não bloqueia nada e
   * que nenhum ecrã mostra. */
  if (await ehCasaComQuartos(supabase, propriedade_id)) {
    return {
      ok: false,
      error: 'Esta casa reserva-se por quarto, ou por inteiro através da reserva de grupo.',
      status: 400,
    }
  }

  /* Cabem? O caminho de grupo já validava a capacidade; este não validava
   * nada, e aceitava um pedido de 50 pessoas para um T0. O número vai para
   * `num_hospedes`, que é quantos boletins o SIBA vai esperar. */
  const capacidade = Number(prop.capacidade) || 0
  if (capacidade > 0 && num_hospedes > capacidade) {
    return {
      ok: false,
      error: `Este alojamento leva ${capacidade} ${capacidade === 1 ? 'pessoa' : 'pessoas'}.`,
      status: 400,
    }
  }

  const { data: conflicts, error: cErr } = await supabase
    .from('bookings')
    .select('id')
    .eq('propriedade_id', propriedade_id)
    .not('estado', 'in', '("cancelada","no_show")')
    .lt('check_in', check_out)
    .gt('check_out', check_in)
    .limit(1)

  if (cErr) {
    console.error('[validateBookingRequest] conflict check', cErr.message)
    return { ok: false, error: 'Erro ao verificar disponibilidade.', status: 500 }
  }
  if (conflicts && conflicts.length > 0) {
    return { ok: false, error: 'Estas datas já não estão disponíveis.', status: 409 }
  }

  /* E agora a mesma pergunta às plataformas, ao vivo.
   *
   * A verificação acima corre contra a nossa base, e a nossa base sabe o que a
   * sincronização das 04:00 lhe contou — até 24 horas atrás. Uma reserva feita
   * no Airbnb esta manhã não está lá. Ver `disponibilidade-ao-vivo.ts` para o
   * porquê de isto fechar por omissão. */
  const aoVivo = await verificarDisponibilidadeAoVivo([prop as Property], check_in, check_out)
  if (!aoVivo.livre) {
    console.warn('[book] recusado pela verificação ao vivo', aoVivo.motivo, aoVivo.feed)
    return { ok: false, error: mensagemAoVivo(aoVivo), status: aoVivo.motivo === 'ocupado' ? 409 : 503 }
  }

  const [rules, tarifas, rates] = await Promise.all([
    adminGetPriceRules(owner_id ?? undefined),
    adminGetTarifas(owner_id ?? undefined),
    adminGetPlatformRates(owner_id ?? undefined),
  ])
  const preco_total = calculatePriceWithRules(prop as Property, check_in, check_out, rules, tarifas, rates, 'direto').total

  return {
    ok: true,
    data: {
      guestId, bookingId, nome, email, telefone, notas,
      propriedade_id, check_in, check_out, num_hospedes,
      owner_id, preco_total,
      prop: prop as Property & { nome: string; owner_id: string | null },
    },
  }
}

export interface ValidatedGroupRequest {
  guestId: string
  grupoId: string
  nome: string
  email: string
  telefone?: string
  notas?: string
  casa: Property & { nome: string; owner_id: string | null }
  /** Quartos a reservar, já validados como livres, com preço e pessoas. */
  quartos: Array<{ quarto: Property; preco: number; pessoas: number }>
  check_in: string
  check_out: string
  num_hospedes: number
  owner_id: string | null
  preco_total: number
}

export type GroupValidationResult =
  | { ok: true; data: ValidatedGroupRequest }
  | { ok: false; error: string; status: number }

/**
 * Validação de um pedido de **casa inteira** vindo do site público.
 *
 * Reaproveita as regras do pedido normal (nome, email, datas, limites) e
 * acrescenta o que só existe no grupo: resolver os quartos da casa, confirmar
 * que **todos** estão livres, e calcular o preço somando quarto a quarto com
 * as regras de cada um.
 *
 * Não insere nada — quem chama decide. O hóspede é a mesma pessoa em todas as
 * reservas do grupo, por isso há um só `guestId`.
 */
export async function validateGroupBookingRequest(
  payload: { guest?: Record<string, unknown>; booking?: Record<string, unknown> },
): Promise<GroupValidationResult> {
  const supabase = createAdminClient()
  const guest = payload?.guest ?? {}
  const booking = payload?.booking ?? {}

  const casaId = booking.propriedade_id
  if (typeof casaId !== 'string' || !UUID_RE.test(casaId)) {
    return { ok: false, error: 'propriedade_id obrigatório', status: 400 }
  }

  const nome = typeof guest.nome === 'string' ? guest.nome.trim() : ''
  if (!nome || nome.length > 200) return { ok: false, error: 'Nome do hóspede obrigatório', status: 400 }

  const email = typeof guest.email === 'string' ? guest.email.trim() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, error: 'Email inválido', status: 400 }
  }

  const check_in = booking.check_in
  const check_out = booking.check_out
  if (typeof check_in !== 'string' || !DATE_RE.test(check_in) ||
      typeof check_out !== 'string' || !DATE_RE.test(check_out) ||
      nights(check_in, check_out) < 1) {
    return { ok: false, error: 'Datas inválidas', status: 400 }
  }
  if (check_in < today() || nights(check_in, check_out) > 365) {
    return { ok: false, error: 'Datas inválidas', status: 400 }
  }

  const num_hospedes = Number(booking.num_hospedes ?? 1)
  if (!Number.isInteger(num_hospedes) || num_hospedes < 1 || num_hospedes > 50) {
    return { ok: false, error: 'Número de hóspedes inválido', status: 400 }
  }

  const notas = typeof booking.notas === 'string' ? booking.notas.trim().slice(0, 2000) : undefined
  const telefone = typeof guest.telefone === 'string' ? guest.telefone.trim().slice(0, 40) : undefined
  // Ver a nota em `validateBookingRequest`: o id é do servidor, sempre.
  const guestId = uuid()

  const { data: casa, error: casaErr } = await supabase
    .from('properties').select('*').eq('id', casaId).single()

  if (casaErr || !casa || casa.ativo === false) {
    return { ok: false, error: 'Alojamento não encontrado', status: 404 }
  }

  const owner_id = casa.owner_id as string | null

  const { data: filhos } = await supabase
    .from('properties')
    .select('*')
    .eq('parent_id', casaId)
    .eq('ativo', true)

  const quartos = (filhos ?? []) as Property[]
  if (quartos.length === 0) {
    return { ok: false, error: 'Este alojamento não se reserva por quartos.', status: 400 }
  }

  const capacidade = quartos.reduce((s, q) => s + (q.capacidade ?? 0), 0)
  if (num_hospedes > capacidade) {
    return {
      ok: false,
      error: `A casa leva ${capacidade} ${capacidade === 1 ? 'pessoa' : 'pessoas'}.`,
      status: 400,
    }
  }

  // Todos os quartos têm de estar livres. Uma casa inteira com um quarto
  // ocupado não é uma casa inteira — e aceitar o pedido criaria a expetativa
  // errada num hóspede que já fez as contas às camas.
  const { data: conflitos, error: cErr } = await supabase
    .from('bookings')
    .select('propriedade_id')
    .in('propriedade_id', quartos.map(q => q.id))
    .not('estado', 'in', '("cancelada","no_show")')
    .lt('check_in', check_out)
    .gt('check_out', check_in)

  if (cErr) {
    console.error('[validateGroupBookingRequest] conflict check', cErr.message)
    return { ok: false, error: 'Erro ao verificar disponibilidade.', status: 500 }
  }
  if (conflitos && conflitos.length > 0) {
    return { ok: false, error: 'Estas datas já não estão disponíveis para a casa inteira.', status: 409 }
  }

  /* Ao vivo, os feeds de todos os quartos — uma casa inteira com um quarto
   * vendido no Airbnb esta manhã não é uma casa inteira. Os feeds são lidos em
   * paralelo, por isso três quartos custam o tempo do mais lento. */
  const aoVivo = await verificarDisponibilidadeAoVivo(quartos, check_in, check_out)
  if (!aoVivo.livre) {
    console.warn('[book/grupo] recusado pela verificação ao vivo', aoVivo.motivo, aoVivo.feed)
    return { ok: false, error: mensagemAoVivo(aoVivo), status: aoVivo.motivo === 'ocupado' ? 409 : 503 }
  }

  const [rules, tarifas, rates] = await Promise.all([
    adminGetPriceRules(owner_id ?? undefined),
    adminGetTarifas(owner_id ?? undefined),
    adminGetPlatformRates(owner_id ?? undefined),
  ])

  // Maiores primeiro: é a mesma ordem da app interna, para o hóspede e o
  // anfitrião verem a mesma distribuição.
  const ordenados = [...quartos].sort((a, b) => b.capacidade - a.capacidade)
  let porAlojar = num_hospedes

  const detalhe = ordenados.map(quarto => {
    const pessoas = Math.min(quarto.capacidade, Math.max(porAlojar, 0))
    porAlojar -= pessoas
    return {
      quarto,
      pessoas,
      preco: calculatePriceWithRules(quarto, check_in, check_out, rules, tarifas, rates, 'direto').total,
    }
  })

  const preco_total = Math.round(detalhe.reduce((s, d) => s + d.preco, 0) * 100) / 100

  return {
    ok: true,
    data: {
      guestId,
      grupoId: uuid(),
      nome, email, telefone, notas,
      casa: casa as Property & { nome: string; owner_id: string | null },
      quartos: detalhe,
      check_in, check_out, num_hospedes,
      owner_id, preco_total,
    },
  }
}

/**
 * Re-verifica conflito de datas — usado no preenchimento pós-pagamento, onde
 * pode ter passado tempo desde a validação inicial.
 *
 * Aqui a verificação ao vivo comporta-se ao contrário do resto: **só uma
 * ocupação de facto conta**. Do outro lado desta função há um pagamento já
 * feito e um reembolso automático à espera; recusar por um feed que não
 * respondeu seria devolver o dinheiro a quem tinha direito à reserva, por
 * causa de dez segundos de rede. A trava do caminho da reserva
 * (`disponibilidade-ao-vivo.ts`) é que fecha por omissão — esta não.
 */
export async function hasConflict(propriedade_id: string, check_in: string, check_out: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('propriedade_id', propriedade_id)
    .not('estado', 'in', '("cancelada","no_show")')
    .lt('check_in', check_out)
    .gt('check_out', check_in)
    .limit(1)

  if (data && data.length > 0) return true

  const { data: prop } = await supabase
    .from('properties').select('nome, ical_feeds').eq('id', propriedade_id).maybeSingle()
  if (!prop) return false

  const aoVivo = await verificarDisponibilidadeAoVivo([prop as Property], check_in, check_out)
  return !aoVivo.livre && aoVivo.motivo === 'ocupado'
}
