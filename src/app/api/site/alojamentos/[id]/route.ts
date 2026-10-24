import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'
import { validarAlteracoesAlojamento } from '@/lib/fotos-alojamento'
import { fotosDe } from '@/lib/site-alojamentos'

const supabase = createAdminClient()

/**
 * PATCH /api/site/alojamentos/[id]
 * O construtor do site grava aqui fotografias, descrição, comodidades e
 * regras de um alojamento — só estes campos, nunca o registo inteiro (que
 * tem credenciais do SIBA e endereços iCal que o construtor não conhece).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Grava a cada fotografia carregada ou reordenada: cortesia, não defesa.
  if (!checkRateLimit(`site-alojamento:${userId}`, 120, 60_000).allowed) {
    return NextResponse.json({ error: 'Demasiadas alterações seguidas. Aguarda um momento.' }, { status: 429 })
  }

  const { id } = await params
  const { data: atual, error: errLer } = await supabase
    .from('properties')
    .select('owner_id, imagem_url, fotos')
    .eq('id', id)
    .maybeSingle()
  if (errLer) return NextResponse.json({ error: 'Não foi possível ler o alojamento.' }, { status: 500 })
  if (!atual || atual.owner_id !== userId) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  const corpo = await req.json().catch(() => null)
  const r = validarAlteracoesAlojamento(corpo, fotosDe(atual), userId)
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })

  const { data, error } = await supabase
    .from('properties')
    .update(r.alteracoes)
    .eq('id', id)
    .eq('owner_id', userId)
    .select('id, imagem_url, fotos, descricao, regras_casa, comodidades')
    .single()
  if (error) {
    console.error('[PATCH /api/site/alojamentos]', id, error.message)
    return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
