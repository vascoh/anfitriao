import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { carregarPlano, gravarMarcacao } from '@/lib/limpezas-server'
import { validarMarcacao } from '@/lib/limpezas'
import { addDays, today } from '@/lib/utils'

/**
 * Limpezas do anfitrião.
 *
 * GET [?de&ate]  → plano (por omissão: há 7 dias até daqui a 30)
 * POST {propriedade_id, data, estado, nota?} → marcar / desfazer
 */

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const hoje = today()
  const de = req.nextUrl.searchParams.get('de') ?? addDays(hoje, -7)
  const ate = req.nextUrl.searchParams.get('ate') ?? addDays(hoje, 30)
  if (!DATA_RE.test(de) || !DATA_RE.test(ate) || ate < de || ate > addDays(de, 120)) {
    return NextResponse.json({ error: 'Intervalo inválido (máximo 120 dias).' }, { status: 400 })
  }

  const { plano, erro } = await carregarPlano(userId, { de, ate })
  if (erro) return NextResponse.json({ error: erro }, { status: 500 })
  return NextResponse.json(plano)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const rl = await verificarLimite(`limpezas:${userId}`, 120, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const v = validarMarcacao(body, today())
  if ('erro' in v) return NextResponse.json({ error: v.erro }, { status: 400 })

  // Só se marca o que está no plano — e o plano só tem quartos deste anfitrião.
  const { plano, erro } = await carregarPlano(userId, { de: v.data, ate: v.data })
  if (erro) return NextResponse.json({ error: erro }, { status: 500 })
  if (!plano.limpezas.some(l => l.propriedade_id === v.propriedade_id)) {
    return NextResponse.json({ error: 'Não há limpeza neste quarto nesse dia.' }, { status: 404 })
  }

  const falha = await gravarMarcacao(userId, { ...v, por: 'Anfitrião' })
  if (falha) return NextResponse.json({ error: falha }, { status: 500 })
  return NextResponse.json({ ok: true })
}
