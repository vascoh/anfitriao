import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Guest } from '@/lib/types'
import { canUpsertRow } from '@/lib/ownership'
import { protegerCampos, revelarLista } from '@/lib/campos-sensiveis'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(revelarLista(data))
}

/**
 * POST /api/guests
 * Guarda um hóspede com owner_id do utilizador autenticado.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: Guest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!(await canUpsertRow(supabase, 'guests', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar este hóspede.' }, { status: 403 })
  }

  let row: Record<string, unknown>
  try {
    row = protegerCampos({ ...body, owner_id: userId })
  } catch (err) {
    // Só acontece em produção sem APP_ENCRYPTION_KEY. Falhar é deliberado.
    console.error('[POST /api/guests] encriptação', err)
    return NextResponse.json({ error: 'Erro ao guardar hóspede.' }, { status: 500 })
  }

  const { error } = await supabase.from('guests').upsert(row)
  if (error) {
    console.error('[POST /api/guests]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar hóspede.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
