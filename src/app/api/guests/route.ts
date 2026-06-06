import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Guest } from '@/lib/types'

const supabase = createAdminClient()

/**
 * POST /api/guests
 * Guarda um hóspede com owner_id do utilizador autenticado.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json() as Guest
  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('guests').upsert(row)
  if (error) {
    console.error('[POST /api/guests]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar hóspede.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
