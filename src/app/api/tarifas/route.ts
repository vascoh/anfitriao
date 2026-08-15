import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { canUpsertRow, ownsProperty } from '@/lib/ownership'
import { validarRegraPreco } from '@/lib/validacao-precos'
import type { Tarifa } from '@/lib/types'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('tarifas')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Tarifa

  /* Guarda de IDOR: um upsert por id do cliente permitia sobrepor — e
   * ficar com — a linha de outro anfitrião. Ver lib/ownership.ts. */
  if (!(await canUpsertRow(supabase, 'tarifas', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar este registo.' }, { status: 403 })
  }
  if (!(await ownsProperty(supabase, (body as { property_id?: unknown }).property_id, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  const problema = validarRegraPreco(body as unknown as Record<string, unknown>)
  if (problema) {
    return NextResponse.json({ error: problema.mensagem, campo: problema.campo }, { status: 400 })
  }

  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('tarifas').upsert(row)
  if (error) {
    console.error('[POST /api/tarifas]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar tarifa.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('tarifas').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/tarifas]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
