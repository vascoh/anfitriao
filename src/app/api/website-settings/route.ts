import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { adminGetWebsiteSettings } from '@/lib/db-admin'
import type { WebsiteSettings } from '@/lib/types'
import { normalizarSlug, validarSlug } from '@/lib/slug'

/* Lista de permitidos.
 *
 * Guardava-se `{ ...body, owner_id }`, ou seja o que o browser mandasse —
 * incluindo o `id` da linha, que é a chave primária, e qualquer coluna futura.
 * As definições do site são poucas e conhecidas; escrevê-las por nome é o que
 * impede que um campo novo na tabela passe a ser escrito por engano. */
const CAMPOS: Array<keyof WebsiteSettings> = [
  'enabled', 'nome', 'descricao', 'logo_texto', 'host_nome', 'host_bio',
  'email', 'telefone', 'email_reservas', 'assinatura_email',
  'min_noites', 'antecedencia_dias',
  'cor_primaria', 'cor_secundaria', 'idioma', 'template_id', 'fonte', 'secoes',
]

function apenasCamposConhecidos(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const campo of CAMPOS) {
    if (campo in body) row[campo] = body[campo]
  }
  return row
}

const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const settings = await adminGetWebsiteSettings(userId)
  return NextResponse.json(settings)
}

/**
 * POST /api/website-settings
 * Upserts website settings for the authenticated owner.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json() as Record<string, unknown>

  /* O endereço em forma canónica, e `null` quando não há nenhum — nunca `''`,
   * que colide no UNIQUE entre contas diferentes. Ver lib/slug.ts. */
  const slug = normalizarSlug(body.slug)
  const problemaSlug = validarSlug(slug)
  if (problemaSlug) {
    return NextResponse.json({ error: problemaSlug }, { status: 400 })
  }

  const row = { ...apenasCamposConhecidos(body), slug, owner_id: userId }

  const { data: existing } = await supabase
    .from('website_settings')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  // 23505 pode ser por slug duplicado (esperado, mensagem específica) ou por
  // outra constraint (ex.: PK) — mapear tudo para "URL em uso" mascarava bugs
  // reais (ver migration 026: website_settings.id tinha DEFAULT fixo).
  function duplicateMessage(error: { code?: string; message: string }): string {
    if (error.code === '23505' && error.message.includes('slug')) {
      return 'Este URL já está a ser usado. Escolhe outro.'
    }
    return 'Erro ao guardar.'
  }

  if (existing) {
    const { error } = await supabase
      .from('website_settings')
      .update(row)
      .eq('owner_id', userId)
    if (error) {
      console.error('[POST /api/website-settings]', error.message)
      return NextResponse.json({ error: duplicateMessage(error) }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('website_settings')
      .insert(row)
    if (error) {
      console.error('[POST /api/website-settings]', error.message)
      return NextResponse.json({ error: duplicateMessage(error) }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
