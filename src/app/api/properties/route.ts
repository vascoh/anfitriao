import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { getAccountByClerkId } from '@/lib/accounts'
import type { Property } from '@/lib/types'
const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map casas_banho → casasBanho (property row format)
  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const { casas_banho, ...rest } = row
    return { ...rest, casasBanho: casas_banho }
  })
  return NextResponse.json(mapped)
}

/**
 * POST /api/properties
 * Guarda uma propriedade com verificação de limite do plano.
 * Adiciona automaticamente o owner_id para multi-tenancy.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const account = await getAccountByClerkId(userId)
  if (!account) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  // Contar propriedades de topo (não quartos dentro de outra) deste utilizador
  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .is('parent_id', null)

  const atual = count ?? 0

  if (atual >= account.propriedades_max) {
    return NextResponse.json(
      {
        error: `Limite do teu plano atingido (${atual}/${account.propriedades_max} propriedades). Faz upgrade para adicionar mais.`,
        code:  'LIMIT_REACHED',
        limite: account.propriedades_max,
        atual,
      },
      { status: 403 },
    )
  }

  // Guardar com owner_id
  const body = await req.json() as Property & { casas_banho?: number }

  // Normalizar casasBanho → casas_banho (padrão do DB)
  const { casasBanho, ...rest } = body as Property
  const row = { ...rest, casas_banho: casasBanho ?? body.casas_banho ?? 1, owner_id: userId }

  const { error } = await supabase.from('properties').upsert(row)
  if (error) {
    console.error('[POST /api/properties]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar propriedade.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('properties').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/properties]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
