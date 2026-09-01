import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { fetchIcalText, isAllowedIcalUrl, mensagemUrlRecusado } from '@/lib/ical-fetch'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { SOURCE_LABEL } from '@/lib/labels'
import type { IcalFeed, BookingSource } from '@/lib/types'
import { CANAIS_IMPORTAVEIS } from '@/lib/canais'
import { logAudit } from '@/lib/audit'

const supabase = createAdminClient()

/**
 * Gestão de um canal de cada vez.
 *
 * Existe porque acrescentar um calendário passava por gravar a **propriedade
 * inteira** com o formulário de edição: o feed só era escrito quando o
 * anfitrião carregasse em «Guardar alterações» no fim de um formulário com
 * trinta campos. Quem colava o endereço e saía da página perdia-o sem aviso —
 * e a página de canais, que não tem os outros trinta campos, não tinha sequer
 * como gravar sem os apagar.
 *
 * Aqui só se toca no `ical_feeds`, e o feed é **testado antes de ser
 * guardado**: um endereço errado é recusado na hora, com a razão, em vez de
 * ficar guardado a falhar silenciosamente até alguém reparar.
 */

/** Lê o alojamento confirmando que é deste anfitrião. */
async function carregarProprio(propertyId: string, userId: string) {
  const { data } = await supabase
    .from('properties')
    .select('id, nome, owner_id, ical_feeds')
    .eq('id', propertyId)
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  /* Cada tentativa faz um pedido a um servidor de terceiros com um endereço
   * escolhido por quem chama. Conta-se na base e não em memória: a contagem
   * por instância não trava pedidos simultâneos, que é precisamente a forma de
   * transformar isto num amplificador. */
  const rl = await verificarLimite(`canais:add:${userId}`, 20, 60 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas de ligação. Tenta daqui a uma hora.' },
      { status: 429 },
    )
  }

  let body: { propertyId?: unknown; url?: unknown; source?: unknown; nome?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { propertyId, url, source } = body
  if (typeof propertyId !== 'string' || !propertyId) {
    return NextResponse.json({ error: 'Alojamento em falta.' }, { status: 400 })
  }
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'Cola o endereço do calendário.' }, { status: 400 })
  }
  if (typeof source !== 'string' || !CANAIS_IMPORTAVEIS.includes(source as Exclude<BookingSource, 'direto'>)) {
    return NextResponse.json({ error: 'Plataforma desconhecida.' }, { status: 400 })
  }

  const endereco = url.trim()

  // Recusar cedo, com a razão: o anfitrião fica a saber se o problema é o
  // http, o domínio ou o endereço estar partido.
  if (!isAllowedIcalUrl(endereco)) {
    return NextResponse.json({ error: mensagemUrlRecusado(endereco) }, { status: 400 })
  }

  const prop = await carregarProprio(propertyId, userId)
  if (!prop) return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })

  const feeds = (prop.ical_feeds as IcalFeed[] | null) ?? []

  /* O mesmo endereço duas vezes é sempre engano — e caro: cada evento entrava
   * uma vez por feed e a ocupação passava dos 100 %. */
  if (feeds.some(f => f.url === endereco)) {
    return NextResponse.json(
      { error: 'Este calendário já está ligado a este alojamento.' },
      { status: 409 },
    )
  }

  /* Testar antes de guardar. É o que dá ao anfitrião a resposta que ele quer
   * no momento em que cola o endereço — «isto funciona?» — em vez de a
   * adiar para a madrugada seguinte. */
  let eventos = 0
  try {
    const texto = await fetchIcalText(endereco)
    if (!texto.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({
        error: 'O endereço respondeu, mas não devolveu um calendário. Confirma que copiaste o endereço de exportação (.ics) e não o link da página.',
      }, { status: 400 })
    }
    eventos = (texto.match(/BEGIN:VEVENT/g) ?? []).length
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, teste: 'falhou' }, { status: 400 })
  }

  const feed: IcalFeed = {
    id: crypto.randomUUID(),
    url: endereco,
    source: source as BookingSource,
    nome: typeof body.nome === 'string' && body.nome.trim()
      ? body.nome.trim().slice(0, 60)
      : SOURCE_LABEL[source as BookingSource],
    // Ficou testado agora; não se finge que já sincronizou — só que foi lido.
    last_count: eventos,
  }

  const { error } = await supabase
    .from('properties')
    .update({ ical_feeds: [...feeds, feed] })
    .eq('id', propertyId)
    .eq('owner_id', userId)

  if (error) {
    console.error('[POST /api/canais]', error.message)
    return NextResponse.json({ error: 'Não foi possível guardar o canal.' }, { status: 500 })
  }

  await logAudit({
    actorId: userId,
    entidade: 'property',
    entidadeId: propertyId,
    acao: 'canal_ligado',
    detalhes: { fonte: feed.source, nome: feed.nome, eventos },
  })

  return NextResponse.json({ ok: true, feed, eventos })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const propertyId = req.nextUrl.searchParams.get('propertyId')
  const feedId = req.nextUrl.searchParams.get('feedId')
  if (!propertyId || !feedId) {
    return NextResponse.json({ error: 'propertyId e feedId obrigatórios.' }, { status: 400 })
  }

  const prop = await carregarProprio(propertyId, userId)
  if (!prop) return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })

  const feeds = (prop.ical_feeds as IcalFeed[] | null) ?? []
  const alvo = feeds.find(f => f.id === feedId)
  if (!alvo) return NextResponse.json({ error: 'Canal não encontrado.' }, { status: 404 })

  const { error } = await supabase
    .from('properties')
    .update({ ical_feeds: feeds.filter(f => f.id !== feedId) })
    .eq('id', propertyId)
    .eq('owner_id', userId)

  if (error) {
    console.error('[DELETE /api/canais]', error.message)
    return NextResponse.json({ error: 'Não foi possível desligar o canal.' }, { status: 500 })
  }

  /* As reservas já importadas ficam.
   *
   * São reservas verdadeiras, com hóspedes verdadeiros a chegar — algumas já
   * com fatura emitida ou boletim comunicado. Desligar um calendário é dizer
   * «para de trazer novidades», nunca «apaga o que já aconteceu». Conta-se
   * quantas são para a interface o poder dizer, em vez de deixar o anfitrião
   * a adivinhar o que é que acabou de acontecer ao calendário dele. */
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('propriedade_id', propertyId)
    .eq('owner_id', userId)
    .like('uid_externo', `${feedId}::%`)

  await logAudit({
    actorId: userId,
    entidade: 'property',
    entidadeId: propertyId,
    acao: 'canal_desligado',
    detalhes: { fonte: alvo.source, nome: alvo.nome, reservas_mantidas: count ?? 0 },
  })

  return NextResponse.json({ ok: true, reservasMantidas: count ?? 0 })
}
