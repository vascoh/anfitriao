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
