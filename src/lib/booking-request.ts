import 'server-only'
import { createAdminClient } from './supabase'
import { uuid, nights, today } from './utils'
import { calculatePriceWithRules } from './reservations'
import { adminGetPriceRules, adminGetTarifas, adminGetPlatformRates } from './db-admin'
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

  const guestId = typeof guest.id === 'string' && UUID_RE.test(guest.id) ? guest.id : uuid()
  const bookingId = typeof booking.id === 'string' && UUID_RE.test(booking.id) ? booking.id : uuid()

  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propriedade_id)
    .single()

  if (propErr || !prop || prop.ativo === false) {
    return { ok: false, error: 'Propriedade não encontrada', status: 404 }
  }

  const owner_id = prop.owner_id as string | null

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

/** Re-verifica conflito de datas — usado no preenchimento pós-pagamento, onde pode ter passado tempo desde a validação inicial. */
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
  return !!data && data.length > 0
}
