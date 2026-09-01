import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'

const supabase = createAdminClient()

/* Rota pública: qualquer pessoa na landing page chega aqui sem sessão. Vale
 * portanto a regra das rotas públicas — limite de pedidos contado na base (o
 * limitador em memória não trava pedidos simultâneos) e validação com tetos. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  /* Pelo IP, porque não há sessão. O cabeçalho pode ser forjado, mas quem o
   * forja tem de o variar a cada pedido para escapar — e isso já não é o
   * formulário submetido cem vezes que isto existe para travar. */
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
  const rl = await verificarLimite(`newsletter:${ip}`, 5, 60 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Tenta daqui a uma hora.' },
      { status: 429 },
    )
  }

  let body: { email?: unknown; origem?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) {
    return NextResponse.json({ error: 'Indica um email válido.' }, { status: 400 })
  }

  const origem = typeof body.origem === 'string' ? body.origem.slice(0, 100) : null

  /* A primeira subscrição manda; as seguintes não tocam na linha.
   *
   * A chave de conflito é o **email vindo do pedido** e não há sessão que
   * prove que é de quem o escreve. Uma escrita que atualizasse a linha
   * deixaria qualquer pessoa submeter o email de outra e limpar-lhe o
   * `removido_em` — ou seja, voltar a subscrever quem tinha pedido para sair.
   * Com `ignoreDuplicates`, o pior que um estranho consegue é não fazer nada.
   *
   * A resposta é a mesma nos dois casos, de propósito: dizer "já estás
   * subscrito" contaria a quem perguntasse quem está na lista. */
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email, origem },
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[POST /api/newsletter]', error.message)
    return NextResponse.json({ error: 'Não foi possível subscrever. Tenta mais tarde.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
