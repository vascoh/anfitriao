import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { getAccountByClerkId } from '@/lib/accounts'
import { contarUnidadesReservaveis } from '@/lib/reservations'

/**
 * GET /api/conta/limite — quantas unidades alugáveis a conta usa e quantas o
 * plano permite.
 *
 * Serve para o ecrã «Nova propriedade» avisar **antes** de se preencher o
 * formulário, e não só com um erro no fim. A conta é por omissão do servidor
 * (service role), por isso devolve só os três números que o ecrã precisa.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const account = await getAccountByClerkId(userId)
  if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  const { data, error } = await createAdminClient()
    .from('properties')
    .select('id, parent_id, ativo')
    .eq('owner_id', userId)
  if (error) return NextResponse.json({ error: 'Não foi possível contar os alojamentos.' }, { status: 500 })

  return NextResponse.json({
    plano: account.plano,
    max: account.propriedades_max,
    usadas: contarUnidadesReservaveis(data ?? []),
  })
}
