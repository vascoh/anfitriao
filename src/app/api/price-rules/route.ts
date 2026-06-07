import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { PriceRule } from '@/lib/types'

const supabase = createAdminClient()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as PriceRule
  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('price_rules').upsert(row)
  if (error) {
    console.error('[POST /api/price-rules]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar regra.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
