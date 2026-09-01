import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Guard de ownership para upserts com admin client (bypassa RLS).
 * Devolve true se o upsert é permitido: a linha não existe, pertence ao
 * utilizador, ou não tem dono (owner_id null — linhas legadas/públicas
 * que o anfitrião pode reclamar). Devolve false se pertence a OUTRO owner
 * — sem isto, um upsert por id permitiria sobrepor e "roubar" dados de
 * outro tenant (IDOR).
 */
/**
 * O alojamento é deste anfitrião?
 *
 * As tabelas penduradas numa propriedade (`tarifas`, `price_rules`,
 * `platform_rates`) aceitam um `property_id` vindo do cliente. Sem esta
 * verificação, escrever uma tarifa na propriedade de outra pessoa era um
 * pedido bem formado — e o `owner_id` da linha ficava com o nome de quem a
 * escreveu, o que faz a coisa parecer legítima.
 *
 * Uma propriedade sem dono (`owner_id` null, legado) pode ser reclamada, como
 * em `canUpsertRow`.
 */
export async function ownsProperty(
  supabase: SupabaseClient,
  propertyId: unknown,
  userId: string,
): Promise<boolean> {
  if (typeof propertyId !== 'string' || !propertyId) return true
  const { data } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .maybeSingle()
  if (!data) return false
  return data.owner_id === null || data.owner_id === userId
}

/**
 * Esta propriedade é uma casa com quartos ativos — ou seja, não é uma unidade
 * alugável?
 *
 * `unidadesReservaveis` (lib/reservations.ts) diz que uma casa com quartos é o
 * contentor deles e nunca se reserva por inteiro: reserva-se um quarto, ou
 * reservam-se todos (reserva de grupo, `lib/grupos.ts`). Os ecrãs todos já se
 * comportavam assim; o **servidor** não, e a regra só valia enquanto o browser
 * a cumprisse.
 *
 * Uma reserva gravada na casa-mãe é pior do que uma reserva errada: não choca
 * com nada (o conflito é procurado por `propriedade_id`, e a casa não tem
 * reservas), não bloqueia os quartos, não sai no feed iCal que o Amenitiz e as
 * plataformas leem — e não aparece em ecrã nenhum, porque todos filtram por
 * unidades alugáveis. Fica uma reserva invisível numas datas que continuam a
 * ser vendidas a toda a gente.
 *
 * O `id` de uma propriedade é público (anda no URL de `/book/[id]`), portanto
 * chega um pedido a `/api/book` com o id da casa para a criar.
 */
export async function ehCasaComQuartos(
  supabase: SupabaseClient,
  propertyId: unknown,
): Promise<boolean> {
  if (typeof propertyId !== 'string' || !propertyId) return false
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('parent_id', propertyId)
    .eq('ativo', true)
    .limit(1)
  return !!data && data.length > 0
}

export async function canUpsertRow(
  supabase: SupabaseClient,
  table: string,
  id: unknown,
  userId: string,
): Promise<boolean> {
  if (typeof id !== 'string' || !id) return true
  const { data } = await supabase
    .from(table)
    .select('owner_id')
    .eq('id', id)
    .maybeSingle()
  if (!data) return true
  return data.owner_id === null || data.owner_id === userId
}
