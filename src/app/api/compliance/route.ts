import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { encriptar, estaConfigurada as encriptacaoConfigurada } from '@/lib/crypto'

const supabase = createAdminClient()

/** Campos que esta rota aceita — nenhum outro é escrito, mesmo que venha no body. */
const CAMPOS_TEXTO = [
  'rnal_numero',
  'seguro_seguradora',
  'seguro_apolice',
  'livro_reclamacoes_url',
  // Registo no web service do SIBA. A chave de acesso é tratada à parte,
  // porque tem de ser encriptada antes de tocar na base de dados.
  'siba_nipc',
  'siba_estabelecimento',
  'siba_abreviatura',
  'siba_codigo_postal',
  'siba_telefone',
  'siba_nome_contacto',
  'siba_email_contacto',
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

  // Chave de acesso ao SIBA: encriptada antes de ser guardada, e nunca
  // devolvida. String vazia significa "apagar"; ausente significa "não mexer",
  // para que gravar o resto do formulário não obrigue a reescrever a chave.
  if ('siba_chave_acesso' in body) {
    const bruta = typeof body.siba_chave_acesso === 'string' ? body.siba_chave_acesso.trim() : ''
    if (bruta === '') {
      patch.siba_chave_acesso = null
    } else if (!encriptacaoConfigurada()) {
      // Guardar uma credencial do Estado em claro seria pior do que recusar.
      return NextResponse.json(
        { error: 'O servidor não tem chave de encriptação configurada (APP_ENCRYPTION_KEY). A chave de acesso ao SIBA não pode ser guardada em segurança.' },
        { status: 503 },
      )
    } else {
      patch.siba_chave_acesso = encriptar(bruta.slice(0, 200))
    }
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

  // A chave encriptada nunca sai do servidor — nem sequer cifrada. O que a
  // interface precisa de saber é apenas se existe uma.
  const { siba_chave_acesso, ...semSegredos } = data as Record<string, unknown>
  return NextResponse.json({ ...semSegredos, siba_chave_definida: Boolean(siba_chave_acesso) })
}
