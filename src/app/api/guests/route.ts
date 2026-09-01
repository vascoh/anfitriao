import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Guest } from '@/lib/types'
import { canUpsertRow } from '@/lib/ownership'
import { protegerCampos, revelarLista } from '@/lib/campos-sensiveis'
import { carregarTudo } from '@/lib/supabase-tudo'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  /* Em páginas: o PostgREST corta a 1000 sem avisar, e um hóspede que não
   * apareça na lista é uma ficha que se volta a criar do zero — a mesma pessoa
   * duas vezes, e dois boletins onde devia haver um. */
  const { linhas, erro } = await carregarTudo<Record<string, unknown>>(() =>
    supabase
      .from('guests')
      .select('*')
      .eq('owner_id', userId)
      .order('criado_em', { ascending: false })
      // Desempate estável: ver a nota sobre ordenação em lib/supabase-tudo.ts.
      .order('id', { ascending: true }),
  )

  if (erro) return NextResponse.json({ error: erro }, { status: 500 })
  return NextResponse.json(revelarLista(linhas))
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
