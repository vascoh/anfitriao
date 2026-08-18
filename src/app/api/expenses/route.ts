import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { canUpsertRow, ownsProperty } from '@/lib/ownership'
import { today } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', userId)
    .order('data', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/expenses
 * Cria/atualiza uma despesa. Whitelist de campos — owner_id forçado no
 * servidor a partir da sessão Clerk (nunca confiar no valor do cliente).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: Partial<Expense>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.descricao?.trim() || typeof body.valor !== 'number' || body.valor < 0) {
    return NextResponse.json({ error: 'Descrição e valor são obrigatórios.' }, { status: 400 })
  }


  /* Guarda de IDOR: um upsert por id do cliente permitia sobrepor — e
   * ficar com — a linha de outro anfitrião. Ver lib/ownership.ts. */
  if (!(await canUpsertRow(supabase, 'expenses', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar este registo.' }, { status: 403 })
  }

  // A despesa aponta para um alojamento: tem de ser um dos meus.
  if (!(await ownsProperty(supabase, body.propriedade_id, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  const row = {
    id: body.id,
    owner_id: userId,
    propriedade_id: body.propriedade_id || null,
    categoria: body.categoria ?? 'outro',
    descricao: body.descricao.trim(),
    valor: body.valor,
    data: body.data ?? today(),
  }

  const { error } = await supabase.from('expenses').upsert(row)
  if (error) {
    console.error('[POST /api/expenses]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar despesa.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/expenses]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
