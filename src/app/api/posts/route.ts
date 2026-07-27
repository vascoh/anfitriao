import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Post } from '@/lib/types'

const supabase = createAdminClient()
const SLUG_RE = /^[a-z0-9-]+$/

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/posts — cria/atualiza. owner_id forçado no servidor. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: Partial<Post>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const slug = body.slug?.trim().toLowerCase() ?? ''
  if (!body.titulo?.trim() || !slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Título e slug (letras minúsculas, números e hífens) são obrigatórios.' }, { status: 400 })
  }

  const row = {
    id: body.id,
    owner_id: userId,
    slug,
    titulo: body.titulo.trim(),
    resumo: body.resumo?.trim() || null,
    conteudo: body.conteudo?.trim() ?? '',
    imagem_capa: body.imagem_capa?.trim() || null,
    publicado: body.publicado === true,
    atualizado_em: new Date().toISOString(),
  }

  const { error } = await supabase.from('posts').upsert(row)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe um post com esse slug.' }, { status: 409 })
    }
    console.error('[POST /api/posts]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar post.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('posts').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/posts]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
