import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

const supabase = createAdminClient()

/** Campos que esta rota aceita — nenhum outro é escrito, mesmo que venha no body. */
const CAMPOS_TEXTO = [
  'rnal_numero',
  'seguro_seguradora',
  'seguro_apolice',
  'livro_reclamacoes_url',
] as const

const CAMPOS_DATA = [
  'rnal_data',
  'seguro_validade',
  'certificado_energetico_validade',
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function limparTexto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s === '' ? null : s
}

function limparData(v: unknown): string | null | undefined {
  if (v === null || v === '') return null
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return undefined // inválido → ignorar
  // Rejeita datas impossíveis (ex.: 2026-02-31) que passariam o regex
  const d = new Date(v + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined
  return v
}

/**
 * PATCH /api/compliance
 * Atualiza os campos do cofre de conformidade de um alojamento.
 *
 * Só escreve nos campos de conformidade — nunca em preço, capacidade ou
 * qualquer outro atributo — mesmo que venham no corpo do pedido.
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
  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId em falta' }, { status: 400 })
  }

  // Confirma a posse antes de escrever (o admin client ignora RLS)
  const { data: existing, error: errLookup } = await supabase
    .from('properties')
    .select('id, nome, owner_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (errLookup) return NextResponse.json({ error: errLookup.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Alojamento não encontrado' }, { status: 404 })
  if (existing.owner_id !== null && existing.owner_id !== userId) {
    return NextResponse.json({ error: 'Sem permissão para alterar este alojamento.' }, { status: 403 })
  }

  const patch: Record<string, string | boolean | null> = {}

  for (const campo of CAMPOS_TEXTO) {
    if (campo in body) patch[campo] = limparTexto(body[campo], 200)
  }

  for (const campo of CAMPOS_DATA) {
    if (campo in body) {
      const v = limparData(body[campo])
      if (v !== undefined) patch[campo] = v
    }
  }

  if ('livro_reclamacoes_registado' in body) {
    patch.livro_reclamacoes_registado = body.livro_reclamacoes_registado === true
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('owner_id', userId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    // owner_id legado a null: o guard acima já validou, mas o .eq falhou
    return NextResponse.json({ error: 'Não foi possível atualizar o alojamento.' }, { status: 409 })
  }

  // Auditado apesar de não ser billing/permissões/exclusão: o cofre é prova
  // legal (ver dossier de inspeção no roadmap) e interessa saber quando cada
  // item foi declarado. Não guarda valores, só que campos mudaram.
  await logAudit({
    actorId: userId,
    entidade: 'property',
    entidadeId: propertyId,
    acao: 'conformidade_atualizada',
    detalhes: { nome: existing.nome, campos: Object.keys(patch) },
  })

  return NextResponse.json(data)
}
