import 'server-only'
import { createAdminClient } from './supabase'
import type { SibaBookingRow } from './siba'

export interface SibaBookingRowWithId extends SibaBookingRow {
  booking_id: string
}

/**
 * Carrega as reservas (com dados de hóspede/propriedade) de um anfitrião num
 * período, no formato usado pelo export CSV e pela submissão automática
 * SIBA/AIMA. Único ponto de acesso a dados partilhado entre
 * `/api/siba-export` e `/api/siba-submit` — evita duplicar o join.
 */
export async function fetchSibaRowsForOwner(
  ownerId: string,
  from: string,
  to: string,
): Promise<{ rows: SibaBookingRowWithId[]; error?: string }> {
  const supabase = createAdminClient()

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, num_hospedes, hospede_id, propriedade_id')
    .eq('owner_id', ownerId)
    .gte('check_in', from)
    .lte('check_in', to)
    .not('estado', 'in', '("cancelada","no_show")')
    .order('check_in', { ascending: true })

  if (bookingsError) {
    console.error('[siba-fetch]', bookingsError.message)
    return { rows: [], error: 'Erro ao carregar reservas' }
  }
  if (!bookings || bookings.length === 0) return { rows: [] }

  const guestIds = bookings.map(b => b.hospede_id).filter(Boolean) as string[]
  const propIds = [...new Set(bookings.map(b => b.propriedade_id))]

  const [guestsRes, propsRes] = await Promise.all([
    guestIds.length > 0
      ? supabase.from('guests').select('id, nome, data_nascimento, nacionalidade, numero_documento, tipo_documento, data_validade_doc, sexo, pais_emissao').in('id', guestIds)
      : Promise.resolve({ data: [] }),
    supabase.from('properties').select('id, nome').in('id', propIds),
  ])

  const guestMap = new Map((guestsRes.data ?? []).map(g => [g.id, g]))
  const propMap = new Map((propsRes.data ?? []).map(p => [p.id, p]))

  const rows = bookings.map(b => {
    const g = guestMap.get(b.hospede_id ?? '')
    return {
      booking_id: b.id,
      check_in: b.check_in,
      check_out: b.check_out,
      num_hospedes: b.num_hospedes,
      alojamento: propMap.get(b.propriedade_id)?.nome ?? '',
      nome: g?.nome ?? '',
      data_nascimento: g?.data_nascimento,
      nacionalidade: g?.nacionalidade,
      numero_documento: g?.numero_documento,
      tipo_documento: g?.tipo_documento,
      data_validade_doc: g?.data_validade_doc,
      sexo: g?.sexo,
      pais_emissao: g?.pais_emissao,
    }
  })

  return { rows }
}
