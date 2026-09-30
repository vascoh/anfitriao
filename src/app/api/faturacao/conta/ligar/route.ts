import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { ligarContaExistente, normalizarSubdominio, paraPublica } from '@/lib/faturacao'

/**
 * POST — liga uma conta InvoiceXpress que o anfitrião já tinha.
 *
 * Para quem já fatura (muitas vezes pelo Amenitiz): mantém a série e a
 * numeração em vez de abrir uma segunda conta para o mesmo NIF. A emissão
 * automática fica desligada — ver `ligarContaExistente`.
 */

const NIF_RE = /^\d{9}$/

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Cada tentativa é uma chamada ao fornecedor com uma chave que pode estar
  // errada; não queremos servir de oráculo para adivinhar chaves.
  const rl = checkRateLimit(`faturacao-ligar:${userId}`, 10, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas tentativas. Tenta daqui a pouco.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    conta?: string; apiKey?: string; nomeFiscal?: string; nif?: string
  } | null

  const conta = normalizarSubdominio(body?.conta ?? '')
  if (!conta) {
    return NextResponse.json(
      { error: 'Não reconheço esse endereço. Cola o endereço que vês no browser dentro do InvoiceXpress, ou só o nome da conta.' },
      { status: 400 },
    )
  }

  const apiKey = body?.apiKey?.trim() ?? ''
  if (!/^[A-Za-z0-9]{20,100}$/.test(apiKey)) {
    return NextResponse.json({ error: 'A chave da API não tem o formato esperado.' }, { status: 400 })
  }

  const nomeFiscal = body?.nomeFiscal?.trim()
  if (!nomeFiscal) {
    return NextResponse.json({ error: 'O nome ou a designação social é obrigatório.' }, { status: 400 })
  }

  const nif = body?.nif?.replace(/\s/g, '') || null
  if (nif && !NIF_RE.test(nif)) {
    return NextResponse.json({ error: 'O NIF tem de ter 9 dígitos.' }, { status: 400 })
  }

  const r = await ligarContaExistente(userId, { conta, apiKey, nomeFiscal, nif })
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado })

  await logAudit({
    actorId: userId,
    entidade: 'faturacao_conta',
    entidadeId: r.conta.id,
    acao: 'conta_ligada',
    // Nunca a chave.
    detalhes: { fornecedor: r.conta.fornecedor, conta, nif, serie: r.conta.serie_nome },
  })

  return NextResponse.json({ conta: paraPublica(r.conta) })
}
