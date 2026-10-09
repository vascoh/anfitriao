import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { MAX_RESPOSTAS, validarResposta, type RespostaGuardada } from '@/lib/respostas-guardadas'

/**
 * Respostas guardadas da caixa de entrada.
 *
 * GET              → as do anfitrião, por nome
 * POST {titulo, corpo}       → nova
 * PATCH {id, titulo, corpo}  → editar
 * DELETE ?id=      → apagar
 */

const supabase = createAdminClient()
const COLUNAS = 'id, titulo, corpo'

async function dono(): Promise<string | null> {
  const { userId } = await auth()
  return userId ?? null
}

export async function GET() {
  const userId = await dono()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase
    .from('respostas_guardadas')
    .select(COLUNAS)
    .eq('owner_id', userId)
    .order('titulo', { ascending: true })
    .limit(MAX_RESPOSTAS)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ respostas: (data ?? []) as RespostaGuardada[] })
}

async function corpoJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  return await req.json().catch(() => null) as Record<string, unknown> | null
}

export async function POST(req: NextRequest) {
  const userId = await dono()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rl = await verificarLimite(`respostas:${userId}`, 60, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })

  const body = await corpoJson(req)
  const v = validarResposta(body?.titulo, body?.corpo)
  if ('erro' in v) return NextResponse.json({ error: v.erro }, { status: 400 })

  const { count } = await supabase
    .from('respostas_guardadas')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if ((count ?? 0) >= MAX_RESPOSTAS) {
    return NextResponse.json({ error: `Máximo de ${MAX_RESPOSTAS} respostas guardadas.` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('respostas_guardadas')
    .insert({ owner_id: userId, titulo: v.titulo, corpo: v.corpo })
    .select(COLUNAS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resposta: data as RespostaGuardada })
}

export async function PATCH(req: NextRequest) {
  const userId = await dono()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rl = await verificarLimite(`respostas:${userId}`, 60, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })

  const body = await corpoJson(req)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 })
  const v = validarResposta(body?.titulo, body?.corpo)
  if ('erro' in v) return NextResponse.json({ error: v.erro }, { status: 400 })

  const { data, error } = await supabase
    .from('respostas_guardadas')
    .update({ titulo: v.titulo, corpo: v.corpo, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', userId)
    .select(COLUNAS)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
  return NextResponse.json({ resposta: data as RespostaGuardada })
}

export async function DELETE(req: NextRequest) {
  const userId = await dono()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 })
  const { error, count } = await supabase
    .from('respostas_guardadas')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('owner_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
