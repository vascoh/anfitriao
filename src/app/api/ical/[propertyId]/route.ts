import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase'
import { generateIcal } from '@/lib/ical'
import { eBloqueio } from '@/lib/reservations'
import { carregarTudo } from '@/lib/supabase-tudo'
import { today } from '@/lib/utils'
const supabase = createAdminClient()

// UID estável mas não reversível: o id real da reserva não pode sair num feed
// público — dá acesso ao GET /api/checkin/[bookingId] (PII do hóspede).
function publicUid(bookingId: string): string {
  return createHash('sha256').update(`anfitriao-ical:${bookingId}`).digest('hex').slice(0, 32)
}

/**
 * `?origem=diretas` — o feed para dar a um gestor de canais.
 *
 * Quem lê este calendário determina o que ele deve dizer, e há dois casos
 * diferentes:
 *
 * - **Uma plataforma ligada diretamente** (o Airbnb a ler-nos, sem ninguém no
 *   meio) precisa de **toda** a ocupação: ela não sabe o que o Booking vendeu,
 *   e uma data que lhe escondamos é uma data que ela vende por cima. É o
 *   comportamento por omissão.
 * - **Um gestor de canais** (o Amenitiz) precisa **só das reservas diretas**.
 *   As outras foram ele que as criou: devolver-lhas é, no melhor caso,
 *   redundante, e no pior um bloqueio nosso por cima de uma reserva dele que
 *   ninguém sabe desfazer depois. As reservas importadas reconhecem-se pelo
 *   `uid_externo`, que só as linhas vindas de um feed têm.
 *
 * O que distingue os dois não é uma preferência: é a topologia da instalação.
 * Por isso é um parâmetro explícito no endereço, e não uma definição escondida
 * — o endereço que se cola no Amenitiz diz, ao ser lido, o que faz.
 */
type Origem = 'todas' | 'diretas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const origem: Origem = req.nextUrl.searchParams.get('origem') === 'diretas' ? 'diretas' : 'todas'

  const [{ data: prop }, { data: quartos }] = await Promise.all([
    supabase.from('properties').select('id, nome, owner_id').eq('id', propertyId).single(),
    supabase.from('properties').select('id, ativo, owner_id').eq('parent_id', propertyId),
  ])

  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  /* Numa casa com quartos, a ocupação vive nos quartos — a casa-mãe não tem
   * reservas próprias desde que deixou de ser unidade alugável (30/07).
   * Exportar só as dela dava um feed **sempre vazio**: quem o colasse no
   * Amenitiz ou no Airbnb via a casa livre todos os dias e vendia por cima de
   * reservas que existem. Uma casa está ocupada quando **qualquer** quarto
   * seu está — é o que este feed passa a dizer. */
  const idsOcupacao = [
    propertyId,
    ...(quartos ?? [])
      .filter(q => q.ativo !== false)
      // Só quartos do mesmo dono: um `parent_id` apontado de fora não injeta
      // datas no calendário que este anfitrião publica nas plataformas.
      .filter(q => q.owner_id === prop.owner_id)
      .map(q => q.id as string),
  ]

  /* Paginado, e só o que ainda não terminou.
   *
   * Este é o feed que as plataformas leem para saber o que **não** podem
   * vender. O PostgREST corta as respostas às mil linhas sem o dizer, e a
   * consulta trazia o histórico todo desde sempre: passadas mil reservas, as
   * que ficassem de fora do corte eram as mais recentes — precisamente as
   * futuras. O calendário publicado no Airbnb e no Booking anunciava livres
   * noites que estão vendidas. É o mesmo erro que já tinha sido corrigido na
   * sincronização e no relatório mensal; faltava aqui, que é o lado por onde
   * ele se paga com uma dupla reserva.
   *
   * O passado não vai no feed: um gestor de canais só precisa do que ainda
   * está por acontecer, e é assim que as próprias plataformas publicam os
   * delas. Sem isto, um alojamento com anos de uso arrasta a agenda toda em
   * cada leitura. */
  const { linhas: bookings, erro } = await carregarTudo<{
    id: string; hospede_id: string | null; uid_externo?: string
    check_in: string; check_out: string; estado: string
  }>(() =>
    supabase
      .from('bookings').select('id, hospede_id, uid_externo, check_in, check_out, estado')
      .in('propriedade_id', idsOcupacao)
      .not('estado', 'in', '("cancelada","no_show")')
      .gte('check_out', today())
      // Desempate estável: ver a nota sobre ordenação em lib/supabase-tudo.ts.
      .order('check_in', { ascending: true })
      .order('id', { ascending: true }),
  )

  /* Um feed truncado não se publica. Devolver as reservas que se conseguiram
   * ler seria anunciar como livre o que não coube na leitura — e as
   * plataformas acreditam nele. Um erro faz o Airbnb manter a última leitura
   * boa; um feed incompleto faz o Airbnb vender por cima. */
  if (erro) {
    console.error('[ical export] leitura das reservas falhou', propertyId, erro)
    return NextResponse.json({ error: 'Calendar temporarily unavailable' }, { status: 503 })
  }

  /* Ao gestor de canais, só o que ele não sabe. Ver a nota sobre `?origem`:
   * as importadas foram ele que as criou, e devolver-lhas cria um bloqueio
   * nosso por cima de uma reserva dele. */
  const aExportar = origem === 'diretas'
    ? bookings.filter(b => !b.uid_externo)
    : bookings

  // Sem nomes de hóspedes: o feed é acessível a qualquer pessoa que conheça o
  // propertyId (visível nos URLs públicos /book) — só datas de ocupação.
  const events = aExportar.map(b => ({
    uid: `${publicUid(b.id)}@anfitriao`,
    // Uma reserva importada de um canal não tem hóspede (o iCal não o
    // transporta) e não é um bloqueio — ver `eBloqueio`.
    summary: eBloqueio(b) ? 'Bloqueado' : 'Reservado',
    start: b.check_in,
    end: b.check_out,
  }))

  /* O nome do calendário diz qual dos dois feeds é. Quem cola três endereços
   * no Amenitiz vê-os todos com o mesmo nome e não tem como distinguir o que
   * exporta tudo do que exporta só as diretas. */
  const nome = origem === 'diretas'
    ? `${prop.nome as string} (reservas diretas)`
    : (prop.nome as string)

  const ics = generateIcal(events, nome)

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${propertyId}${origem === 'diretas' ? '-diretas' : ''}.ics"`,
      /* `s-maxage` além do `max-age`: ler o parâmetro do endereço torna a rota
       * dinâmica e tira-lhe o `revalidate`, portanto a proteção contra
       * leituras seguidas passa a ser a cache da CDN — que é por URL completo,
       * parâmetro incluído, e por isso serve os dois feeds sem os misturar. */
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
