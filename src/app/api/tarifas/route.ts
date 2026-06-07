import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Tarifa } from '@/lib/types'

const supabase = createAdminClient()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Tarifa
  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('tarifas').upsert(row)
  if (error) {
    console.error('[POST /api/tarifas]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar tarifa.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
