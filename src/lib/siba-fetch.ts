import 'server-only'
import { createAdminClient } from './supabase'
import { revelarLista } from './campos-sensiveis'
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

  const propIds = [...new Set(bookings.map(b => b.propriedade_id))]

  /* Uma linha por **pessoa**, não por reserva.
   *
   * O boletim de alojamento é individual desde sempre, e a app passou a
   * modelá-lo assim a 03/08 — mas só no caminho do web service. Este é o do
   * CSV, que é o que se usa **hoje**, enquanto não houver credenciais de web
   * service: exportava só quem reservou, e uma reserva de oito comunicava
   * uma pessoa, deixando sete por comunicar a 100 a 2.000 € cada.
   *
   * Quem não tem ficha própria (reservas anteriores à tabela de ligação)
   * continua a entrar pelo `hospede_id`, para não desaparecer do ficheiro. */
  const { data: ligacoes } = await supabase
    .from('reserva_hospedes')
    .select('booking_id, guest_id, principal')
    .eq('owner_id', ownerId)
    .in('booking_id', bookings.map(b => b.id))

  const porReserva = new Map<string, string[]>()
  for (const l of ligacoes ?? []) {
    const lista = porReserva.get(l.booking_id as string)
    if (lista) lista.push(l.guest_id as string)
    else porReserva.set(l.booking_id as string, [l.guest_id as string])
  }
  for (const b of bookings) {
    if (!porReserva.has(b.id) && b.hospede_id) porReserva.set(b.id, [b.hospede_id])
  }

  const guestIds = [...new Set([...porReserva.values()].flat())]

  const [guestsRes, propsRes] = await Promise.all([
    guestIds.length > 0
      ? supabase.from('guests').select('id, nome, data_nascimento, nacionalidade, numero_documento, tipo_documento, data_validade_doc, sexo, pais_emissao').in('id', guestIds)
      : Promise.resolve({ data: [] }),
    supabase.from('properties').select('id, nome').in('id', propIds),
  ])

  // Decifrados aqui, no único ponto onde o CSV e a submissão leem hóspedes:
  // o boletim precisa do número de documento em claro para ser aceite.
  const guestMap = new Map(revelarLista(guestsRes.data).map(g => [g.id, g]))
  const propMap = new Map((propsRes.data ?? []).map(p => [p.id, p]))

  const rows = bookings.flatMap(b =>
    (porReserva.get(b.id) ?? []).map(guestId => {
      const g = guestMap.get(guestId)
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
    }),
  )

  return { rows }
}
