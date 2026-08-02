import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { submeterBoletins, explicarFalha } from '@/lib/siba-api'
import { boletimDaLinha, unidadeDaPropriedade, type LinhaBoletim } from '@/lib/siba-mapping'
import type { BoletimHospede } from '@/lib/siba-xml'
import { decifrar, estaConfigurada as encriptacaoConfigurada } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { today } from '@/lib/utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface ResultadoPorReserva {
  booking_id: string
  sucesso: boolean
  erro?: string
  faltam?: string[]
}

/**
 * POST /api/siba-submit
 * Body: { from: YYYY-MM-DD, to: YYYY-MM-DD }
 *
 * Entrega ao SIBA os boletins das reservas do período que ainda não foram
 * aceites. Um movimento por propriedade — as credenciais são por
 * estabelecimento, e o bloco `Unidade_Hoteleira` do ficheiro descreve um só.
 *
 * O que falha antes de sair daqui falha com o nome do campo em português: um
 * hóspede sem país de residência é um problema do anfitrião, e o SIBA
 * responderia com um código numérico que não ajuda ninguém.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { from?: string; to?: string } | null
  const from = body?.from
  const to = body?.to

  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json(
      { error: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD, from ≤ to)' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, hospede_id, propriedade_id, siba_status')
    .eq('owner_id', userId)
    .gte('check_in', from)
    .lte('check_in', to)
    .not('estado', 'in', '("cancelada","no_show")')
    .order('check_in', { ascending: true })

  if (bookingsError) {
    console.error('[siba-submit]', bookingsError.message)
    return NextResponse.json({ error: 'Erro ao carregar reservas' }, { status: 500 })
  }

  // Já aceites pelo SIBA não voltam a ser enviadas: entregar duas vezes o
  // mesmo boletim é um erro do lado de lá, não uma inocuidade.
  const porEnviar = (bookings ?? []).filter(b => b.siba_status !== 'submetido')
  if (porEnviar.length === 0) {
    return NextResponse.json({ resultados: [], total: 0, sucesso: 0 })
  }

  const guestIds = [...new Set(porEnviar.map(b => b.hospede_id).filter(Boolean))] as string[]
  const propIds = [...new Set(porEnviar.map(b => b.propriedade_id))]

  const [guestsRes, propsRes] = await Promise.all([
    guestIds.length > 0
      ? supabase.from('guests')
          .select('id, nome, data_nascimento, nacionalidade, numero_documento, tipo_documento, pais_emissao, pais_residencia, local_residencia')
          .in('id', guestIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.from('properties')
      .select('id, nome, endereco, cidade, siba_nipc, siba_estabelecimento, siba_chave_acesso, siba_abreviatura, siba_codigo_postal, siba_telefone, siba_nome_contacto, siba_email_contacto')
      .eq('owner_id', userId)
      .in('id', propIds),
  ])

  const guestMap = new Map((guestsRes.data ?? []).map(g => [g.id as string, g]))
  const propMap = new Map((propsRes.data ?? []).map(p => [p.id as string, p]))

  const resultados: ResultadoPorReserva[] = []

  // Um movimento por propriedade.
  for (const propId of propIds) {
    const prop = propMap.get(propId)
    const reservasDaProp = porEnviar.filter(b => b.propriedade_id === propId)

    if (!prop) {
      for (const b of reservasDaProp) {
        resultados.push({ booking_id: b.id, sucesso: false, erro: 'Alojamento não encontrado.' })
      }
      continue
    }

    const unidade = unidadeDaPropriedade(prop)
    if (!unidade.ok) {
      const erro = `Falta registar o alojamento no SIBA: ${unidade.faltam.join(', ')}.`
      for (const b of reservasDaProp) {
        resultados.push({ booking_id: b.id, sucesso: false, erro, faltam: unidade.faltam })
      }
      continue
    }

    if (!prop.siba_chave_acesso) {
      const erro = 'Falta a chave de acesso ao web service do SIBA para este alojamento.'
      for (const b of reservasDaProp) resultados.push({ booking_id: b.id, sucesso: false, erro })
      continue
    }

    if (!encriptacaoConfigurada()) {
      return NextResponse.json(
        { error: 'Encriptação não configurada no servidor (APP_ENCRYPTION_KEY). Não é possível ler as credenciais do SIBA.' },
        { status: 503 },
      )
    }

    let chaveAcesso: string
    try {
      chaveAcesso = decifrar(prop.siba_chave_acesso as string)
    } catch {
      const erro = 'A chave de acesso guardada não pôde ser lida. Volta a introduzi-la.'
      for (const b of reservasDaProp) resultados.push({ booking_id: b.id, sucesso: false, erro })
      continue
    }

    // Converte, separando o que está pronto do que lhe falta um campo.
    const prontas: Array<{ booking_id: string; boletim: BoletimHospede }> = []
    for (const b of reservasDaProp) {
      const g = guestMap.get(b.hospede_id ?? '')
      const linha: LinhaBoletim = {
        booking_id: b.id,
        check_in: b.check_in,
        check_out: b.check_out,
        nome: (g?.nome as string) ?? '',
        data_nascimento: g?.data_nascimento as string | null,
        nacionalidade: g?.nacionalidade as string | null,
        numero_documento: g?.numero_documento as string | null,
        tipo_documento: g?.tipo_documento as string | null,
        pais_emissao: g?.pais_emissao as string | null,
        pais_residencia: g?.pais_residencia as string | null,
        local_residencia: g?.local_residencia as string | null,
      }
      const convertido = boletimDaLinha(linha)
      if (!convertido.ok) {
        resultados.push({
          booking_id: b.id,
          sucesso: false,
          erro: `Faltam dados do hóspede: ${convertido.faltam.join(', ')}.`,
          faltam: convertido.faltam,
        })
        continue
      }
      prontas.push({ booking_id: b.id, boletim: convertido.boletim })
    }

    if (prontas.length === 0) continue

    // Número de ficheiro sequencial por propriedade — o bloco Envio exige-o.
    const { data: ultima } = await supabase
      .from('siba_submissoes')
      .select('numero_ficheiro')
      .eq('property_id', propId)
      .order('numero_ficheiro', { ascending: false })
      .limit(1)
      .maybeSingle()

    const numeroFicheiro = ((ultima?.numero_ficheiro as number) ?? 0) + 1

    const resposta = await submeterBoletins({
      unidade: unidade.unidade,
      chaveAcesso,
      boletins: prontas.map(p => p.boletim),
      numeroFicheiro,
      dataMovimento: today(),
    })

    // Prova de submissão: fica sempre, tenha corrido bem ou mal.
    await supabase.from('siba_submissoes').insert({
      owner_id: userId,
      property_id: propId,
      booking_ids: prontas.map(p => p.booking_id),
      numero_ficheiro: numeroFicheiro,
      hash_envio: resposta.hashEnvio,
      sucesso: resposta.sucesso,
      codigo_retorno: resposta.codigo,
      mensagem: resposta.sucesso ? null : explicarFalha(resposta),
      resposta_bruta: resposta.respostaBruta ?? null,
      tentativas: resposta.tentativas,
    })

    const agora = new Date().toISOString()
    for (const p of prontas) {
      resultados.push({
        booking_id: p.booking_id,
        sucesso: resposta.sucesso,
        erro: resposta.sucesso ? undefined : explicarFalha(resposta),
      })

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          siba_status: resposta.sucesso ? 'submetido' : 'falhou',
          siba_submitted_at: resposta.sucesso ? agora : null,
          siba_reference: resposta.sucesso ? resposta.hashEnvio.slice(0, 16) : null,
          siba_error: resposta.sucesso ? null : explicarFalha(resposta),
        })
        .eq('id', p.booking_id)
        .eq('owner_id', userId)

      if (updateError) console.error('[siba-submit]', updateError.message)
    }
  }

  await logAudit({
    actorId: userId,
    entidade: 'siba_submissao',
    entidadeId: `${from}_${to}`,
    acao: 'submeter',
    detalhes: {
      total: resultados.length,
      sucesso: resultados.filter(r => r.sucesso).length,
    },
  })

  return NextResponse.json({
    resultados,
    total: resultados.length,
    sucesso: resultados.filter(r => r.sucesso).length,
  })
}
