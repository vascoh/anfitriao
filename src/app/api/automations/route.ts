import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Automation } from '@/lib/types'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/automations — cria/atualiza. owner_id forçado no servidor. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: Partial<Automation>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.nome?.trim() || !body.trigger_tipo || !body.mensagem?.trim()) {
    return NextResponse.json({ error: 'Nome, gatilho e mensagem são obrigatórios.' }, { status: 400 })
  }

  const row = {
    id: body.id,
    owner_id: userId,
    nome: body.nome.trim(),
    trigger_tipo: body.trigger_tipo,
    action_tipo: 'email_hospede' as const,
    assunto: body.assunto?.trim() || body.nome.trim(),
    mensagem: body.mensagem.trim(),
    ativo: body.ativo !== false,
  }

  const { error } = await supabase.from('automations').upsert(row)
  if (error) {
    console.error('[POST /api/automations]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar automação.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('automations').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/automations]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
