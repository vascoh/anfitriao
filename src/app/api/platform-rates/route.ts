import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { canUpsertRow, ownsProperty } from '@/lib/ownership'
import type { PlatformRate } from '@/lib/types'

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('platform_rates')
    .select('*')
    .eq('owner_id', userId)
    .order('plataforma')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as PlatformRate

  /* Guarda de IDOR: um upsert por id do cliente permitia sobrepor — e
   * ficar com — a linha de outro anfitrião. Ver lib/ownership.ts. */
  if (!(await canUpsertRow(supabase, 'platform_rates', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar este registo.' }, { status: 403 })
  }
  if (!(await ownsProperty(supabase, (body as { property_id?: unknown }).property_id, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  const row = { ...body, owner_id: userId }

  const { error } = await supabase.from('platform_rates').upsert(row, { onConflict: 'property_id,plataforma' })
  if (error) {
    console.error('[POST /api/platform-rates]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar taxa.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
