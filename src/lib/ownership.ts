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
