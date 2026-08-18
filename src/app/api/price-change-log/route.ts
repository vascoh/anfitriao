import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { ownsProperty } from '@/lib/ownership'

const supabase = createAdminClient()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { propertyId, tipo, descricao, dadosAnteriores, dadosNovos } = await req.json()

  /* O histórico de preços aponta para um alojamento vindo do cliente e não
   * verificava nada — dava para escrever no histórico do alojamento de outro
   * anfitrião. É a mesma classe do IDOR dos upserts, por uma porta que o
   * teste estrutural não via, porque aqui é um `insert`. */
  if (!(await ownsProperty(supabase, propertyId, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

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
