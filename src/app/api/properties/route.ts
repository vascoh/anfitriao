import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { getAccountByClerkId } from '@/lib/accounts'
import { logAudit } from '@/lib/audit'
import type { Property } from '@/lib/types'
import { contarUnidadesReservaveis } from '@/lib/reservations'
const supabase = createAdminClient()

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', userId)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map casas_banho → casasBanho (property row format).
  //
  // A chave de acesso ao SIBA sai daqui em qualquer circunstância: é uma
  // credencial do anfitrião perante a AIMA e o browser não tem nada que a
  // receber, nem sequer encriptada. A interface só precisa de saber se
  // existe uma guardada.
  const mapped = (data ?? []).map((row: Record<string, unknown>) => {
    const { casas_banho, siba_chave_acesso, ...rest } = row
    return { ...rest, casasBanho: casas_banho, siba_chave_definida: Boolean(siba_chave_acesso) }
  })
  return NextResponse.json(mapped)
}

/**
 * POST /api/properties
 * Guarda uma propriedade com verificação de limite do plano.
 * Adiciona automaticamente o owner_id para multi-tenancy.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const account = await getAccountByClerkId(userId)
  if (!account) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  let body: Property & { casas_banho?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Upsert serve create e update — distinguir para o guard e para o limite do plano
  const { data: existing } = typeof body.id === 'string' && body.id
    ? await supabase.from('properties').select('owner_id').eq('id', body.id).maybeSingle()
    : { data: null }

  if (existing && existing.owner_id !== null && existing.owner_id !== userId) {
    return NextResponse.json({ error: 'Sem permissão para alterar esta propriedade.' }, { status: 403 })
  }

  /* Limite do plano, em unidades alugáveis.
   *
   * Contava-se propriedades de topo, o que deixava um hotel de 40 quartos
   * caber no plano mais barato: os quartos são filhos e não contavam para
   * nada. Passa a contar-se o que se aluga.
   *
   * Simula-se a criação antes de a fazer, porque a resposta depende da
   * estrutura e não de uma soma: acrescentar o **primeiro** quarto a uma casa
   * não gasta unidade nenhuma — a casa deixa de ser alugável no mesmo momento
   * em que o quarto passa a sê-lo. */
  if (!existing) {
    const { data: atuais } = await supabase
      .from('properties')
      .select('id, parent_id, ativo')
      .eq('owner_id', userId)

    const antes = contarUnidadesReservaveis(atuais ?? [])
    const depois = contarUnidadesReservaveis([
      ...(atuais ?? []),
      { id: '__nova__', parent_id: body.parent_id ?? null, ativo: body.ativo !== false },
    ])

    if (depois > antes && antes >= account.propriedades_max) {
      const rotulo = body.parent_id ? 'quartos' : 'alojamentos'
      return NextResponse.json(
        {
          error: `Limite do teu plano atingido (${antes}/${account.propriedades_max} ${rotulo}). Faz upgrade para adicionar mais.`,
          code:  'LIMIT_REACHED',
          limite: account.propriedades_max,
          atual: antes,
        },
        { status: 403 },
      )
    }
  }

  // Normalizar casasBanho → casas_banho (padrão do DB)
  const { casasBanho, ...rest } = body as Property
  const row = { ...rest, casas_banho: casasBanho ?? body.casas_banho ?? 1, owner_id: userId }

  const { error } = await supabase.from('properties').upsert(row)
  if (error) {
    console.error('[POST /api/properties]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar propriedade.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: existing } = await supabase.from('properties').select('nome').eq('id', id).maybeSingle()

  const { error } = await supabase.from('properties').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/properties]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  await logAudit({
    actorId: userId,
    entidade: 'property',
    entidadeId: id,
    acao: 'eliminada',
    detalhes: { nome: existing?.nome ?? null },
  })

  return NextResponse.json({ ok: true })
}
