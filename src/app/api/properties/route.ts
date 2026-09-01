import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { getAccountByClerkId } from '@/lib/accounts'
import { logAudit } from '@/lib/audit'
import type { Property } from '@/lib/types'
import { contarUnidadesReservaveis } from '@/lib/reservations'
import { ownsProperty } from '@/lib/ownership'
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
  {
    const { data: atuais } = await supabase
      .from('properties')
      .select('id, parent_id, ativo')
      .eq('owner_id', userId)

    const lista = atuais ?? []
    const idNovo = (typeof body.id === 'string' && body.id) ? body.id : '__nova__'
    const depoisDaEscrita = {
      id: idNovo,
      parent_id: body.parent_id ?? null,
      ativo: body.ativo !== false,
    }

    /* A verificação corre também nas **alterações**, não só nas criações.
     *
     * Só olhava para `!existing`, portanto reativar um quarto desativado
     * — ou passar um quarto a alojamento independente — acrescentava
     * unidades alugáveis sem passar pelo limite. Quem chegasse ao teto
     * desativava um quarto, criava outro e reativava o primeiro. */
    const antes = contarUnidadesReservaveis(lista)
    const depois = contarUnidadesReservaveis([
      ...lista.filter(p => p.id !== idNovo),
      depoisDaEscrita,
    ])

    if (depois > antes && depois > account.propriedades_max) {
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

  /* A casa-mãe é minha?
   *
   * Sem isto, um alojamento podia declarar-se quarto da casa de outra pessoa.
   * A casa passaria a ter um "quarto" que não é dela — e o feed iCal que ela
   * exporta agrega os quartos, portanto o intruso injetava datas ocupadas no
   * calendário que ela publica nas plataformas. */
  if (!(await ownsProperty(supabase, body.parent_id, userId))) {
    return NextResponse.json({ error: 'Alojamento principal não encontrado.' }, { status: 404 })
  }

  /* A árvore tem dois níveis e só dois: casa → quartos.
   *
   * Passou a ser possível ligar um alojamento já existente a uma casa (antes
   * só se podia decidir isso no momento da criação, o que deixava quartos
   * criados à solta sem forma de os arrumar). Com essa liberdade vêm três
   * formas de partir o modelo, e nenhuma delas dá erro na base — dão árvores
   * que o `unidadesReservaveis` e o feed iCal não sabem percorrer:
   *
   *   1. um alojamento apontado a si próprio;
   *   2. um quarto apontado a outro quarto (três níveis);
   *   3. uma casa que já tem quartos a tornar-se quarto de outra.
   *
   * Todas se recusam aqui, e não só no ecrã: o ecrã é uma cortesia, esta é a
   * garantia. */
  if (body.parent_id) {
    if (body.parent_id === body.id) {
      return NextResponse.json(
        { error: 'Um alojamento não pode ser quarto de si próprio.' },
        { status: 400 },
      )
    }

    const { data: pai } = await supabase
      .from('properties')
      .select('parent_id, nome')
      .eq('id', body.parent_id)
      .maybeSingle()

    if (pai?.parent_id) {
      return NextResponse.json(
        { error: `"${pai.nome}" já é um quarto de outra casa. Os quartos não se dividem em mais quartos.` },
        { status: 400 },
      )
    }

    if (typeof body.id === 'string' && body.id) {
      const { count: filhos } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', body.id)
        .eq('owner_id', userId)

      if ((filhos ?? 0) > 0) {
        return NextResponse.json({
          error: 'Este alojamento já tem quartos, por isso não pode passar a ser quarto de outra casa. Move ou remove primeiro os quartos dele.',
        }, { status: 400 })
      }
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

  /* O que vai atrás sem ninguém dizer.
   *
   * `bookings.propriedade_id` tem ON DELETE CASCADE: apagar um alojamento
   * apaga **todas as reservas dele** — e com elas o número da fatura, o ATCUD
   * e a data de comunicação ao SIBA, que vivem nas linhas das reservas. A
   * fatura continua a existir no fornecedor certificado e a coima por não
   * conseguir apresentar registos continua a existir na lei; o que desaparece
   * é a única ligação entre as duas coisas.
   *
   * Documentos com prazo legal de conservação não se apagam com dois toques
   * num botão. Quem quer deixar de ver um alojamento desativa-o — a app já
   * trata alojamentos inativos como se não existissem, sem perder nada. */
  const { data: comHistoria } = await supabase
    .from('bookings')
    .select('id, fatura_numero, siba_status')
    .eq('propriedade_id', id)
    .eq('owner_id', userId)

  const comFatura = (comHistoria ?? []).filter(b => b.fatura_numero).length
  const comBoletim = (comHistoria ?? []).filter(b => b.siba_status === 'submetido').length

  if (comFatura > 0 || comBoletim > 0) {
    const partes = [
      comFatura > 0 ? `${comFatura} ${comFatura === 1 ? 'fatura emitida' : 'faturas emitidas'}` : null,
      comBoletim > 0 ? `${comBoletim} ${comBoletim === 1 ? 'boletim comunicado' : 'boletins comunicados'}` : null,
    ].filter(Boolean).join(' e ')

    return NextResponse.json({
      error: `Este alojamento tem ${partes}. Esses registos têm prazo legal de conservação e apagá-lo levava-os com ele. Desativa-o em vez de o eliminar: deixa de aparecer em todo o lado e não se perde nada.`,
    }, { status: 409 })
  }

  const reservasQueVaoAtras = (comHistoria ?? []).length

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
    // Fica o que foi arrastado: sem isto, o registo diz que se apagou um
    // alojamento e cala que se apagaram doze reservas com ele.
    detalhes: { nome: existing?.nome ?? null, reservas_eliminadas: reservasQueVaoAtras },
  })

  return NextResponse.json({ ok: true })
}
