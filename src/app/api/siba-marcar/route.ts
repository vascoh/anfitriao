import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase'
import { buildSibaCsv } from '@/lib/siba'
import { fetchSibaRowsForOwner } from '@/lib/siba-fetch'
import { logAudit } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/siba-marcar — regista que os boletins de um período foram
 * entregues à mão no portal SIBA.
 *
 * O estado da comunicação só era escrito pelo web service da AIMA, que precisa
 * de credenciais que quase nenhum anfitrião tem hoje. Quem usa o caminho real
 * — exportar o CSV e carregá-lo no portal — não tinha onde dizer que o fez, e
 * ficava com todas as reservas marcadas como por comunicar para sempre. Um
 * painel de conformidade que acusa incumprimento a quem cumpriu ensina-se a si
 * próprio a ser ignorado.
 *
 * Marca exatamente as reservas que saíram no CSV do mesmo período: o mesmo
 * cálculo, para não afirmar que se entregou o que o ficheiro não levava.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const limite = checkRateLimit(`siba-marcar:${userId}:${getClientIp(req)}`, 20, 60_000)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tente daqui a pouco.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as { from?: string; to?: string }
  const { from, to } = body

  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json(
      { error: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD, from ≤ to)' },
      { status: 400 },
    )
  }

  const { rows, error: erroLeitura } = await fetchSibaRowsForOwner(userId, from, to)
  if (erroLeitura) return NextResponse.json({ error: erroLeitura }, { status: 500 })

  const ids = [...new Set(rows.map(r => r.booking_id))]
  if (ids.length === 0) {
    return NextResponse.json({ marcadas: 0, pessoas: 0 })
  }

  const supabase = createAdminClient()
  const agora = new Date().toISOString()

  const { error: erroEscrita } = await supabase
    .from('bookings')
    .update({
      siba_status: 'submetido',
      siba_metodo: 'csv',
      siba_submitted_at: agora,
      siba_error: null,
    })
    .in('id', ids)
    .eq('owner_id', userId)

  if (erroEscrita) {
    return NextResponse.json({ error: erroEscrita.message }, { status: 500 })
  }

  /* A prova é o conteúdo, não a marcação: guarda-se o resumo do ficheiro que
   * foi entregue, para que mais tarde se possa demonstrar **o que** foi
   * comunicado e não apenas que alguém carregou num botão. `numero_ficheiro`
   * fica a 0 porque a numeração pertence ao protocolo do web service; aqui
   * quem numera é o portal. */
  const csv = buildSibaCsv(rows)
  await supabase.from('siba_submissoes').insert({
    owner_id: userId,
    property_id: null,
    booking_ids: ids,
    numero_ficheiro: 0,
    hash_envio: createHash('sha256').update(csv, 'utf-8').digest('hex'),
    sucesso: true,
    codigo_retorno: 'CSV',
    mensagem: `Entrega manual no portal SIBA (${from} a ${to})`,
    resposta_bruta: null,
    tentativas: 1,
  })

  await logAudit({
    actorId: userId,
    entidade: 'siba',
    entidadeId: `${from}:${to}`,
    acao: 'marcar_entregue_csv',
    detalhes: { reservas: ids.length, pessoas: rows.length },
  })

  return NextResponse.json({ marcadas: ids.length, pessoas: rows.length })
}
