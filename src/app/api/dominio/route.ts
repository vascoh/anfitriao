import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { adminGetWebsiteSettings } from '@/lib/db-admin'
import { dominioDaPlataforma, estadoDominio, normalizarDominio, problemaDominio, type DominioProprio } from '@/lib/dominios'
import {
  adicionarDominioVercel,
  estadoNaVercel,
  integracaoVercelConfigurada,
  removerDominioVercel,
  verificarDominioVercel,
} from '@/lib/vercel-domains'

const supabase = createAdminClient()

type Linha = DominioProprio & { owner_id: string; id: string }

function resposta(linha: Linha | null) {
  return NextResponse.json({ dominio: linha, integracaoConfigurada: integracaoVercelConfigurada() })
}

async function doUtilizador(ownerId: string): Promise<Linha | null> {
  const { data, error } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Linha | null
}

async function atualizarEstado(linha: Linha): Promise<Linha> {
  if (!integracaoVercelConfigurada()) return linha
  try {
    await verificarDominioVercel(linha.dominio)
    const atual = await estadoNaVercel(linha.dominio)
    const alteracoes = {
      ...atual,
      estado: estadoDominio(atual.verificado, atual.configurado),
      ultimo_erro: null,
      atualizado_em: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('custom_domains')
      .update(alteracoes)
      .eq('owner_id', linha.owner_id)
      .eq('dominio', linha.dominio)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as Linha
  } catch (erro) {
    // Uma falha da API externa não apaga uma associação válida. Mostramos o
    // último estado conhecido e deixamos o utilizador voltar a tentar.
    return { ...linha, ultimo_erro: erro instanceof Error ? erro.message : 'Não foi possível confirmar o domínio.' }
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const linha = await doUtilizador(userId)
    return resposta(linha ? await atualizarEstado(linha) : null)
  } catch (erro) {
    console.error('[GET /api/dominio]', erro)
    return NextResponse.json({ error: 'Não foi possível carregar o domínio.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { dominio?: unknown; acao?: unknown }
  try {
    const existente = await doUtilizador(userId)
    if (body.acao === 'verificar') {
      if (!existente) return NextResponse.json({ error: 'Ainda não existe um domínio para verificar.' }, { status: 404 })
      return resposta(await atualizarEstado(existente))
    }

    if (existente) {
      return NextResponse.json({ error: 'Remove o domínio atual antes de ligares outro.' }, { status: 409 })
    }
    if (!integracaoVercelConfigurada()) {
      return NextResponse.json({ error: 'A gestão automática de domínios ainda não está configurada na plataforma.' }, { status: 503 })
    }

    const dominio = normalizarDominio(body.dominio)
    const problema = problemaDominio(dominio)
    if (problema) return NextResponse.json({ error: problema }, { status: 400 })
    if (dominioDaPlataforma(dominio!)) {
      return NextResponse.json({ error: 'Escolhe um domínio externo ao Anfitrião.' }, { status: 400 })
    }

    const settings = await adminGetWebsiteSettings(userId)
    if (!settings.slug) {
      return NextResponse.json({ error: 'Define primeiro o endereço do teu site de reservas.' }, { status: 400 })
    }

    const adicionado = await adicionarDominioVercel(dominio!)
    let atual = { verificado: adicionado.verified === true, configurado: false, dns: [] as DominioProprio['dns'] }
    try { atual = await estadoNaVercel(dominio!) } catch { /* o DNS pode ainda não existir */ }

    const row = {
      owner_id: userId,
      dominio,
      slug: settings.slug,
      ...atual,
      estado: estadoDominio(atual.verificado, atual.configurado),
      ultimo_erro: null,
      atualizado_em: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('custom_domains').insert(row).select('*').single()
    if (error) {
      // Não deixar um domínio órfão na Vercel se a associação local falhar.
      await removerDominioVercel(dominio!).catch(() => undefined)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este domínio já está ligado a outro site.' }, { status: 409 })
      }
      throw new Error(error.message)
    }
    return resposta(data as Linha)
  } catch (erro) {
    console.error('[POST /api/dominio]', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Não foi possível ligar o domínio.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const existente = await doUtilizador(userId)
    if (!existente) return NextResponse.json({ ok: true })

    if (integracaoVercelConfigurada()) {
      await removerDominioVercel(existente.dominio)
    }
    const { error } = await supabase
      .from('custom_domains')
      .delete()
      .eq('owner_id', userId)
      .eq('dominio', existente.dominio)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (erro) {
    console.error('[DELETE /api/dominio]', erro)
    return NextResponse.json({ error: erro instanceof Error ? erro.message : 'Não foi possível remover o domínio.' }, { status: 502 })
  }
}
