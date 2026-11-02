import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { getClientIp } from '@/lib/rate-limit'
import { carregarPlano, gravarMarcacao, janelaEquipa, resolverAcesso } from '@/lib/limpezas-server'
import { validarMarcacao } from '@/lib/limpezas'
import { sendPushToOwner } from '@/lib/push'
import { fmtDate, today } from '@/lib/utils'

/**
 * Link da equipa de limpeza — público, sem login.
 *
 * GET  → limpezas dos quartos a que o link dá acesso (ontem até +3 semanas)
 * POST {propriedade_id, data, estado, nota?} → marcar feita / problema / desfazer
 *
 * O que sai daqui é o mínimo para limpar: quarto, morada, datas e número de
 * hóspedes. Nada de nomes, contactos, preços ou origem da reserva.
 */

function naoExiste() {
  return NextResponse.json({ error: 'Este link não existe ou foi desligado.' }, { status: 404 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = await verificarLimite(`equipa:get:${getClientIp(req)}`, 240, 3_600_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Tenta daqui a pouco.' }, { status: 429 })

  const { token } = await params
  const acesso = await resolverAcesso(token)
  if (!acesso) return naoExiste()

  const hoje = today()
  const { plano, erro } = await carregarPlano(acesso.owner_id, { ...janelaEquipa(hoje), escolhidas: acesso.propriedade_ids })
  if (erro) return NextResponse.json({ error: 'Não foi possível carregar as limpezas.' }, { status: 500 })

  await createAdminClient().from('limpeza_acessos')
    .update({ ultimo_acesso: new Date().toISOString() }).eq('id', acesso.id)

  return NextResponse.json({ nome: acesso.nome, hoje, ...plano }, {
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rl = await verificarLimite(`equipa:post:${token.slice(0, 12)}:${getClientIp(req)}`, 60, 3_600_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Tenta daqui a pouco.' }, { status: 429 })

  const acesso = await resolverAcesso(token)
  if (!acesso) return naoExiste()

  const hoje = today()
  const v = validarMarcacao(await req.json().catch(() => null), hoje)
  if ('erro' in v) return NextResponse.json({ error: v.erro }, { status: 400 })

  const janela = janelaEquipa(hoje)
  if (v.data < janela.de || v.data > janela.ate) {
    return NextResponse.json({ error: 'Essa limpeza já não está neste link.' }, { status: 400 })
  }
  const { plano, erro } = await carregarPlano(acesso.owner_id, { de: v.data, ate: v.data, escolhidas: acesso.propriedade_ids })
  if (erro) return NextResponse.json({ error: 'Não foi possível gravar.' }, { status: 500 })
  if (!plano.limpezas.some(l => l.propriedade_id === v.propriedade_id)) {
    return NextResponse.json({ error: 'Não há limpeza nesse quarto nesse dia.' }, { status: 404 })
  }

  const falha = await gravarMarcacao(acesso.owner_id, { ...v, por: acesso.nome })
  if (falha) return NextResponse.json({ error: 'Não foi possível gravar.' }, { status: 500 })

  if (v.estado === 'problema') {
    const quarto = plano.unidades[v.propriedade_id]?.nome ?? 'Quarto'
    await sendPushToOwner(acesso.owner_id, {
      title: `Problema na limpeza · ${quarto}`,
      body: `${acesso.nome}, ${fmtDate(v.data)}: ${v.nota ?? ''}`.slice(0, 180),
      url: '/limpezas',
    })
  }

  return NextResponse.json({ ok: true })
}
