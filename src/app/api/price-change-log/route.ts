import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'

const supabase = createAdminClient()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { propertyId, tipo, descricao, dadosAnteriores, dadosNovos } = await req.json()

  const { error } = await supabase.from('price_change_log').insert({
    property_id: propertyId,
    tipo,
    descricao,
    dados_anteriores: dadosAnteriores ?? null,
    dados_novos: dadosNovos ?? null,
    owner_id: userId,
  })
  if (error) console.error('[POST /api/price-change-log]', error.message)

  return NextResponse.json({ ok: true })
}
