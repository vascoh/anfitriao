import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { hashToken, novoToken } from '@/lib/limpezas-server'
import { validarAcesso } from '@/lib/limpezas'
import { logAudit } from '@/lib/audit'

/**
 * Links da equipa de limpeza.
 *
 * GET              → links ativos (sem o token: só existe no momento em que se cria)
 * POST {nome, propriedade_ids} → novo link; devolve o token uma única vez
 * DELETE ?id=      → revogar (o link deixa de abrir no mesmo instante)
 */

const MAX_ATIVOS = 20
const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase
    .from('limpeza_acessos')
    .select('id, nome, propriedade_ids, criado_em, ultimo_acesso')
    .eq('owner_id', userId)
    .is('revogado_em', null)
    .order('criado_em', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ acessos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rl = await verificarLimite(`limpezas-equipa:${userId}`, 20, 3_600_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados links criados. Tenta mais tarde.' }, { status: 429 })

  const { data: props, error: erroProps } = await supabase
    .from('properties').select('id').eq('owner_id', userId)
  if (erroProps) return NextResponse.json({ error: erroProps.message }, { status: 500 })

  const body = await req.json().catch(() => null)
  const v = validarAcesso(body, new Set((props ?? []).map(p => p.id as string)))
  if ('erro' in v) return NextResponse.json({ error: v.erro }, { status: 400 })

  const { count } = await supabase
    .from('limpeza_acessos')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .is('revogado_em', null)
  if ((count ?? 0) >= MAX_ATIVOS) {
    return NextResponse.json({ error: `Máximo de ${MAX_ATIVOS} links ativos. Revoga um primeiro.` }, { status: 400 })
  }

  const token = novoToken()
  const { data, error } = await supabase
    .from('limpeza_acessos')
    .insert({ owner_id: userId, nome: v.nome, propriedade_ids: v.propriedade_ids, token_hash: hashToken(token) })
    .select('id, nome, propriedade_ids, criado_em, ultimo_acesso')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ acao: 'limpeza_link_criado', entidade: 'limpeza_acessos', entidadeId: data.id, actorId: userId })
  return NextResponse.json({ acesso: data, token })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 })

  const { data, error } = await supabase
    .from('limpeza_acessos')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', userId)
    .is('revogado_em', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 })

  await logAudit({ acao: 'limpeza_link_revogado', entidade: 'limpeza_acessos', entidadeId: id, actorId: userId })
  return NextResponse.json({ ok: true })
}
