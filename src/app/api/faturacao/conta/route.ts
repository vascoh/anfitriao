import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  obterConta, criarContaParaAnfitriao, contaComCredenciais, paraPublica,
  getInvoicingAdapter, podeProvisionarFaturacao,
} from '@/lib/faturacao'

/**
 * Conta de faturação do anfitrião.
 *
 * GET    — estado atual (nunca a chave).
 * POST   — cria a conta no fornecedor, em nome do anfitrião.
 * PUT    — liga as credenciais da AT e cria a série. É o passo que torna a
 *          conta capaz de emitir com numeração legal.
 * PATCH  — liga/desliga a emissão automática.
 *
 * O anfitrião nunca vê o InvoiceXpress. É o objetivo: ele quer faturas
 * emitidas, não uma conta noutro sítio para configurar.
 */

const NIF_RE = /^\d{9}$/
/** Subutilizador da AT: NIF/1 até NIF/999. */
const SUBUTILIZADOR_RE = /^\d{9}\/\d{1,3}$/

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const conta = await obterConta(userId)
  return NextResponse.json({
    disponivel: podeProvisionarFaturacao(),
    conta: conta ? paraPublica(conta) : null,
  })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Criar contas noutro serviço é caro e irreversível. Limite apertado.
  const rl = checkRateLimit(`faturacao-conta:${userId}`, 5, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas tentativas. Tenta daqui a pouco.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    nomeFiscal?: string; nif?: string; email?: string; telefone?: string
  } | null

  const nomeFiscal = body?.nomeFiscal?.trim()
  if (!nomeFiscal) {
    return NextResponse.json({ error: 'O nome ou a designação social é obrigatório.' }, { status: 400 })
  }

  const nif = body?.nif?.replace(/\s/g, '') || undefined
  if (nif && !NIF_RE.test(nif)) {
    return NextResponse.json({ error: 'O NIF tem de ter 9 dígitos.' }, { status: 400 })
  }

  const utilizador = await currentUser()
  const email = body?.email?.trim() || utilizador?.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'É preciso um email para criar a conta de faturação.' }, { status: 400 })
  }

  const r = await criarContaParaAnfitriao(userId, {
    nomeOrganizacao: nomeFiscal,
    email,
    nif,
    telefone: body?.telefone?.trim() || null,
    primeiroNome: utilizador?.firstName ?? undefined,
    ultimoNome: utilizador?.lastName ?? undefined,
  })

  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado })

  await logAudit({
    actorId: userId,
    entidade: 'faturacao_conta',
    entidadeId: r.conta.id,
    acao: 'conta_criada',
    detalhes: { fornecedor: r.conta.fornecedor, nif: r.conta.nif },
  })

  return NextResponse.json({ conta: paraPublica(r.conta) })
}

/**
 * PUT — credenciais da AT + série.
 *
 * As duas coisas andam juntas de propósito: o InvoiceXpress só regista séries
 * depois de ter credenciais da AT, e uma conta com AT ligada mas sem série
 * continua a não conseguir emitir. Deixar isto em dois passos separados era
 * garantir que metade dos anfitriões ficava a meio.
 */
export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`faturacao-at:${userId}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas tentativas. Tenta daqui a pouco.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    subutilizador?: string; senha?: string; serie?: string
  } | null

  const subutilizador = body?.subutilizador?.trim() ?? ''
  const senha = body?.senha ?? ''

  if (!SUBUTILIZADOR_RE.test(subutilizador)) {
    return NextResponse.json(
      { error: 'O subutilizador da AT tem o formato NIF/1 — por exemplo 500100200/1.' },
      { status: 400 },
    )
  }
  if (!senha) {
    return NextResponse.json({ error: 'A senha do subutilizador é obrigatória.' }, { status: 400 })
  }

  const par = await contaComCredenciais(userId)
  if (!par) {
    return NextResponse.json(
      { error: 'Ainda não tens conta de faturação, ou as credenciais não puderam ser lidas.' },
      { status: 409 },
    )
  }

  const supabase = createAdminClient()
  const adaptador = getInvoicingAdapter()

  const at = await adaptador.configurarComunicacaoAt(par.credenciais, { subutilizador, senha })
  if (!at.sucesso) {
    await supabase
      .from('faturacao_contas')
      .update({ at_estado: 'falhou', at_erro: at.erro ?? null, atualizado_em: new Date().toISOString() })
      .eq('id', par.conta.id)
    return NextResponse.json(
      { error: at.erro ?? 'A AT recusou as credenciais. Confirma o subutilizador e a senha no Portal das Finanças.' },
      { status: 502 },
    )
  }

  // Série: só se cria uma vez. Reutiliza-se a existente em caso de repetição.
  let serieId = par.conta.serie_id
  let serieNome = par.conta.serie_nome

  if (!serieId) {
    const nome = (body?.serie?.trim() || `ANF${new Date().getFullYear()}`).toUpperCase().slice(0, 20)
    const serie = await adaptador.criarSerie(par.credenciais, nome)
    if (!serie.sucesso) {
      await supabase
        .from('faturacao_contas')
        .update({
          at_estado: 'configurada',
          at_erro: null,
          at_configurada_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', par.conta.id)
      return NextResponse.json(
        { error: `A AT ficou ligada, mas a série não foi criada: ${serie.erro}` },
        { status: 502 },
      )
    }
    serieId = serie.serieId ?? null
    serieNome = serie.serieNome ?? nome
  }

  const { data } = await supabase
    .from('faturacao_contas')
    .update({
      at_estado: 'configurada',
      at_erro: null,
      at_configurada_em: new Date().toISOString(),
      serie_id: serieId,
      serie_nome: serieNome,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', par.conta.id)
    .select()
    .single()

  await logAudit({
    actorId: userId,
    entidade: 'faturacao_conta',
    entidadeId: par.conta.id,
    acao: 'at_configurada',
    // Nunca a senha. O subutilizador é público (é o NIF), a senha não.
    detalhes: { subutilizador, serie: serieNome },
  })

  return NextResponse.json({ conta: paraPublica(data) })
}

/** PATCH — liga/desliga a emissão automática no checkout. */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { emissaoAutomatica?: boolean } | null
  if (typeof body?.emissaoAutomatica !== 'boolean') {
    return NextResponse.json({ error: 'emissaoAutomatica em falta' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faturacao_contas')
    .update({ emissao_automatica: body.emissaoAutomatica, atualizado_em: new Date().toISOString() })
    .eq('owner_id', userId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Ainda não tens conta de faturação.' }, { status: 404 })

  return NextResponse.json({ conta: paraPublica(data) })
}
