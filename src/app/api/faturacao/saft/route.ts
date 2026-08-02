import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { getInvoicingAdapter, contaComCredenciais } from '@/lib/faturacao'

/**
 * GET /api/faturacao/saft?ano=2026&mes=7
 *
 * O ficheiro que o contabilista pede todos os meses. É gerado do lado do
 * fornecedor (é lá que vivem os documentos) e devolvido como URL.
 *
 * A geração é assíncrona: a primeira chamada costuma responder "estou a
 * gerar". O cliente volta a pedir — deliberadamente não se espera aqui, para
 * não segurar uma função de servidor durante um minuto por causa de um
 * ficheiro que o anfitrião vai buscar uma vez por mês.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`saft:${userId}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const ano = Number(url.searchParams.get('ano'))
  const mes = Number(url.searchParams.get('mes'))

  const anoAtual = new Date().getUTCFullYear()
  if (!Number.isInteger(ano) || ano < 2000 || ano > anoAtual + 1) {
    return NextResponse.json({ error: 'Ano inválido.' }, { status: 400 })
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Mês inválido.' }, { status: 400 })
  }

  const par = await contaComCredenciais(userId)
  if (!par) {
    return NextResponse.json({ error: 'Ainda não tens faturação ligada.' }, { status: 409 })
  }

  const r = await getInvoicingAdapter().exportarSaft(par.credenciais, ano, mes)

  if (!r.sucesso) return NextResponse.json({ error: r.erro }, { status: 502 })
  if (r.aindaAGerar) return NextResponse.json({ aindaAGerar: true }, { status: 202 })

  await logAudit({
    actorId: userId,
    entidade: 'faturacao_conta',
    entidadeId: par.conta.id,
    acao: 'saft_exportado',
    detalhes: { ano, mes },
  })

  return NextResponse.json({ url: r.url })
}
