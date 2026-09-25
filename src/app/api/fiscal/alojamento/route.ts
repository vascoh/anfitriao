import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { ownsProperty } from '@/lib/ownership'
import type { ModalidadeAl } from '@/lib/fiscal-irs'

const supabase = createAdminClient()

const MODALIDADES: readonly ModalidadeAl[] = ['apartamento', 'hospedagem', 'moradia', 'quartos']
const VPT_MAX = 100_000_000

/**
 * PATCH /api/fiscal/alojamento
 * Grava os dados fiscais de um alojamento (modalidade, área de contenção, VPT).
 *
 * Só escreve nestes três campos, mesmo que venham outros no corpo.
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const propertyId = typeof body.propertyId === 'string' ? body.propertyId : ''
  if (!propertyId) return NextResponse.json({ error: 'propertyId em falta' }, { status: 400 })

  const patch: Record<string, string | boolean | number | null> = {}
  if ('al_modalidade' in body) {
    const m = body.al_modalidade
    if (m === null || m === '') patch.al_modalidade = null
    else if (typeof m === 'string' && (MODALIDADES as readonly string[]).includes(m)) patch.al_modalidade = m
    else return NextResponse.json({ error: 'Modalidade desconhecida.' }, { status: 400 })
  }
  if ('al_area_contencao' in body) patch.al_area_contencao = body.al_area_contencao === true
  if ('vpt' in body) {
    const v = body.vpt
    if (v === null || v === '') patch.vpt = null
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= VPT_MAX) {
      patch.vpt = Math.round(v * 100) / 100
    } else return NextResponse.json({ error: 'VPT inválido.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para gravar' }, { status: 400 })
  }

  // Confirma a posse antes de escrever (o admin client ignora RLS). Uma
  // propriedade legada sem dono pode ser reclamada, como em todo o projeto.
  if (!(await ownsProperty(supabase, propertyId, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado' }, { status: 404 })
  }

  const { error } = await supabase.from('properties').update(patch).eq('id', propertyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ...patch })
}
