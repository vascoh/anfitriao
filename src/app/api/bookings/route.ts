import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { Booking, BookingStatus, BookingSource } from '@/lib/types'
import { canUpsertRow, ownsProperty, ehCasaComQuartos } from '@/lib/ownership'
import { verificarDisponibilidadeAoVivo } from '@/lib/disponibilidade-ao-vivo'
import { uidDeOrigem } from '@/lib/ical-reconciliacao'
import { logAudit } from '@/lib/audit'
import { carregarTudo } from '@/lib/supabase-tudo'

/* Esta rota lê os calendários das plataformas ao vivo antes de aceitar a
 * reserva (`lib/disponibilidade-ao-vivo.ts`), o que lhe acrescenta uma ida à
 * rede. O teto fica explícito para não depender do que a plataforma de
 * alojamento tiver por omissão. */
export const maxDuration = 20

const supabase = createAdminClient()

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Conjuntos fechados que a base não impõe — ver a nota no POST. */
const ESTADOS: BookingStatus[] = ['pendente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'no_show']
const ORIGENS: BookingSource[] = ['airbnb', 'booking', 'direto', 'expedia', 'vrbo', 'outro']

/**
 * GET /api/bookings[?de=YYYY-MM-DD&ate=YYYY-MM-DD]
 *
 * Sem intervalo devolve tudo — em páginas, porque o PostgREST corta a resposta
 * a 1000 linhas sem dizer nada. Devolvia por isso as 1000 reservas mais
 * recentes e mais nenhuma: num alojamento de 40 quartos, cerca de três meses.
 * O calendário mostrava livre o que estava ocupado e a declaração da taxa
 * turística saía por baixo, sem erro nenhum a assinalar que faltava metade.
 *
 * Com intervalo devolve só o que lá cabe, que é o que quase todas as páginas
 * precisam: um ano de relatórios, um mês de taxa turística.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')

  if ((de && !DATA_RE.test(de)) || (ate && !DATA_RE.test(ate))) {
    return NextResponse.json({ error: 'Datas em formato inválido (YYYY-MM-DD).' }, { status: 400 })
  }

  const { linhas, erro } = await carregarTudo<Booking>(() => {
    let q = supabase
      .from('bookings')
      .select('*')
      .eq('owner_id', userId)
      .order('check_in', { ascending: false })
      // Desempate estável: ver a nota sobre ordenação em lib/supabase-tudo.ts.
      .order('id', { ascending: true })

    /* A estadia sobrepõe-se ao intervalo pedido — não basta a entrada estar
     * lá dentro. Uma reserva de 28 de dezembro a 3 de janeiro conta para os
     * dois anos, e filtrar só pelo `check_in` perdia-a num deles. */
    if (ate) q = q.lte('check_in', ate)
    if (de) q = q.gte('check_out', de)
    return q
  })

  if (erro) return NextResponse.json({ error: erro }, { status: 500 })
  return NextResponse.json(linhas)
}

/**
 * POST /api/bookings
 * Guarda uma reserva com owner_id do utilizador autenticado.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: Booking
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!(await canUpsertRow(supabase, 'bookings', body.id, userId))) {
    return NextResponse.json({ error: 'Sem permissão para alterar esta reserva.' }, { status: 403 })
  }

  /* A reserva é minha, mas o alojamento é de quem?
   *
   * O id de uma propriedade é público — está no URL de `/book/[id]` e nos
   * links do site do anfitrião. Sem esta verificação, qualquer pessoa com
   * conta podia criar reservas no alojamento de outra: `hasConflict` procura
   * por propriedade e não por dono, portanto o site do vizinho passava a
   * responder "datas ocupadas" a todos os hóspedes — e ele não via nada, pois
   * o calendário dele só mostra as reservas com o `owner_id` dele. */
  if (!(await ownsProperty(supabase, body.propriedade_id, userId))) {
    return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })
  }

  // O mesmo para a ficha do hóspede: uma reserva não empresta o acesso aos
  // dados de alguém que é cliente de outro anfitrião.
  if (!(await canUpsertRow(supabase, 'guests', body.hospede_id, userId))) {
    return NextResponse.json({ error: 'Hóspede não encontrado.' }, { status: 404 })
  }

  /* Uma casa com quartos é o contentor deles, não uma unidade alugável — e
   * `/reservas/nova` já não a oferece. Faltava a regra do lado do servidor,
   * onde ela vale para o separador que ficou aberto antes de o primeiro quarto
   * existir e para qualquer escrita que não venha daquele ecrã. Ver
   * `ehCasaComQuartos`: a reserva ficava invisível e não bloqueava nada. */
  if (await ehCasaComQuartos(supabase, body.propriedade_id)) {
    return NextResponse.json({
      error: 'Esta casa tem quartos: reserva um quarto, ou usa a reserva de casa inteira.',
    }, { status: 400 })
  }

  /* Datas coerentes. Não era verificado em lado nenhum do servidor: uma
   * reserva com saída antes da entrada entrava na base e depois aparecia com
   * largura negativa no calendário e noites negativas na receita. */
  const { permitir_sobreposicao, ...campos } = body as unknown as Record<string, unknown>

  /* `estado` e `origem` são conjuntos fechados, e nenhum deles tem restrição na
   * base — só `siba_status` e `fatura_estado` a têm.
   *
   * É o mesmo buraco que o painel de administração já tapou para as contas, e
   * o comentário de lá descreve-o melhor do que eu: «um valor fora do conjunto
   * ficava lá gravado e a app passava a comparar contra uma palavra que não
   * existe». Numa reserva o preço é mais alto: um estado desconhecido não é
   * `cancelada` nem `no_show`, portanto continua a ocupar datas e a contar na
   * receita — e `availableActions` devolve-lhe uma lista vazia, o que deixa a
   * reserva **presa para sempre**, sem transição nenhuma possível. */
  if (campos.estado !== undefined && !ESTADOS.includes(campos.estado as BookingStatus)) {
    return NextResponse.json({ error: 'Estado de reserva desconhecido.' }, { status: 400 })
  }
  if (campos.origem !== undefined && !ORIGENS.includes(campos.origem as BookingSource)) {
    return NextResponse.json({ error: 'Origem de reserva desconhecida.' }, { status: 400 })
  }
  const checkIn = typeof campos.check_in === 'string' ? campos.check_in : ''
  const checkOut = typeof campos.check_out === 'string' ? campos.check_out : ''

  if (!checkIn || !checkOut || checkIn >= checkOut) {
    return NextResponse.json(
      { error: 'A data de saída tem de ser depois da data de entrada.' },
      { status: 400 },
    )
  }

  /* Dupla reserva: a verificação estava só no browser.
   *
   * `/reservas/nova` chamava `detectConflict` sobre a lista que tinha em mão,
   * e mais nada — o servidor aceitava tudo. Isso deixa passar as três formas
   * que interessam: dois separadores abertos ao mesmo tempo, uma lista que
   * ficou velha desde que a página abriu, e qualquer escrita que não venha
   * daquele ecrã. **Editar as datas de uma reserva não tinha verificação
   * nenhuma**, nem no browser — arrastar uma reserva para cima de outra
   * gravava sem uma palavra.
   *
   * O caminho do hóspede (`lib/booking-request.ts`) sempre verificou isto do
   * lado do servidor, e ainda reconfirma no pagamento. Era o caminho do
   * anfitrião — o que cria a maioria das reservas — que estava desprotegido.
   *
   * Cancelar nunca é bloqueado: uma reserva cancelada não ocupa nada. */
  const estado = typeof campos.estado === 'string' ? campos.estado : 'confirmada'
  const libertaDatas = estado === 'cancelada' || estado === 'no_show'

  if (!libertaDatas && permitir_sobreposicao !== true) {
    let q = supabase
      .from('bookings')
      .select('id, check_in, check_out, estado')
      .eq('propriedade_id', campos.propriedade_id as string)
      .eq('owner_id', userId)
      .not('estado', 'in', '("cancelada","no_show")')
      // Sobreposição de intervalos meio-abertos: [entrada, saída[.
      // Sair no dia em que outro entra não é conflito.
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)

    // Numa alteração, a própria reserva não conta como conflito consigo mesma.
    if (typeof campos.id === 'string' && campos.id) q = q.neq('id', campos.id)

    const { data: conflitos, error: cErr } = await q.limit(1)

    if (cErr) {
      console.error('[POST /api/bookings] verificação de conflito', cErr.message)
      return NextResponse.json({ error: 'Não foi possível verificar a disponibilidade.' }, { status: 500 })
    }

    if (conflitos && conflitos.length > 0) {
      const c = conflitos[0]
      return NextResponse.json({
        error: `Estas datas chocam com uma reserva que já existe neste alojamento (${c.check_in} a ${c.check_out}). Verifica as datas ou cancela a outra reserva primeiro.`,
        code: 'CONFLITO',
        conflito: { id: c.id, check_in: c.check_in, check_out: c.check_out },
      }, { status: 409 })
    }

    /* E às plataformas, ao vivo. A verificação acima corre contra a nossa
     * base, que sabe o que a sincronização das 04:00 lhe contou — uma reserva
     * que entrou no Airbnb esta manhã não está lá, e o anfitrião estaria a
     * escrever por cima dela sem nada o avisar. `permitir_sobreposicao`
     * continua a valer: quem sabe o que está a fazer passa à frente. */
    /* Numa alteração, a reserva não choca consigo própria — e do lado do feed
     * ela não se chama pelo nosso `id`, chama-se pelo UID da plataforma. Sem
     * isto, editar uma reserva importada era impossível: o evento que o feed
     * devolve é a própria reserva, e corrigir-lhe o preço (que o iCal não
     * transporta, e de que o financeiro precisa) dava «datas ocupadas».
     *
     * O `uid_externo` é lido da base e não do corpo do pedido: é o servidor
     * que sabe se esta reserva veio de um feed. */
    const aEditar = typeof campos.id === 'string' && campos.id ? campos.id : null
    const { data: existente } = aEditar
      ? await supabase.from('bookings').select('uid_externo').eq('id', aEditar).eq('owner_id', userId).maybeSingle()
      : { data: null }

    const { data: propFeeds } = await supabase
      .from('properties').select('nome, ical_feeds').eq('id', campos.propriedade_id as string).maybeSingle()

    const aoVivo = propFeeds
      ? await verificarDisponibilidadeAoVivo([propFeeds], checkIn, checkOut, {
          ignorarUid: existente?.uid_externo ? uidDeOrigem(existente.uid_externo as string) : null,
        })
      : { livre: true as const }

    if (!aoVivo.livre) {
      return NextResponse.json({
        error: aoVivo.motivo === 'ocupado'
          ? `O calendário de "${aoVivo.feed}" tem estas datas ocupadas — a reserva entrou lá depois da última sincronização. Confirma na plataforma antes de gravar.`
          : `Não foi possível ler o calendário de "${aoVivo.feed}" para confirmar a disponibilidade. Tenta outra vez, ou grava mesmo assim se tiveres a certeza.`,
        code: 'CONFLITO_AO_VIVO',
      }, { status: aoVivo.motivo === 'ocupado' ? 409 : 503 })
    }
  }

  const row = { ...campos, owner_id: userId }

  const { error } = await supabase.from('bookings').upsert(row)
  if (error) {
    console.error('[POST /api/bookings]', error.message)
    return NextResponse.json({ error: 'Erro ao guardar reserva.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  /* Guardar o que se vai apagar, para o registo dizer alguma coisa.
   *
   * Apagar uma reserva é irreversível e leva com ela o histórico, os
   * pagamentos registados e a ligação aos hóspedes. Apagar uma **propriedade**
   * já ficava no `audit_log` desde julho; apagar uma reserva não — e é a
   * mesma classe de ação. A assimetria não tinha razão de ser. */
  const { data: existente } = await supabase
    .from('bookings')
    .select('check_in, check_out, preco_total, estado, hospede_id, propriedade_id')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  const { error } = await supabase.from('bookings').delete().eq('id', id).eq('owner_id', userId)
  if (error) {
    console.error('[DELETE /api/bookings]', error.message)
    return NextResponse.json({ error: 'Erro ao eliminar.' }, { status: 500 })
  }

  if (existente) {
    await logAudit({
      actorId: userId,
      entidade: 'booking',
      entidadeId: id,
      acao: 'eliminada',
      detalhes: {
        datas: `${existente.check_in} → ${existente.check_out}`,
        estado: existente.estado,
        valor: existente.preco_total,
        propriedade_id: existente.propriedade_id,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
