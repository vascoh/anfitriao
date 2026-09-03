import 'server-only'
import { createAdminClient } from './supabase'
import { logAudit } from './audit'
import { revelarCampos } from './campos-sensiveis'
import { today } from './utils'
import { carregarTudo } from './supabase-tudo'
import {
  avaliarRetencao,
  camposAnonimizacao,
  TODOS_OS_GRUPOS,
  type GrupoDados,
} from './retencao'

/**
 * Aplicação da política de retenção (`lib/retencao.ts`) à base de dados.
 *
 * Separado da lógica pura de propósito: as regras e os prazos testam-se sem
 * base de dados nenhuma; aqui só se lê, escreve e deixa rasto na auditoria.
 */

/** Estados que não representam uma estadia — não adiam nem iniciam prazos. */
const ESTADOS_SEM_ESTADIA = ['cancelada', 'no_show']

interface LinhaHospede {
  id: string
  owner_id: string | null
  criado_em: string | null
  anonimizado_grupos: string[] | null
}

/**
 * Anonimiza os grupos indicados de um hóspede e marca o que ficou feito.
 * Idempotente: repetir com os mesmos grupos escreve os mesmos valores.
 */
export async function anonimizarHospede(p: {
  guestId: string
  grupos: GrupoDados[]
  jaFeitos: string[] | null
  /** Clerk userId de quem pediu; null = cron (sistema). */
  actorId: string | null
  motivo: 'retencao' | 'pedido_do_titular'
}): Promise<{ ok: boolean; error?: string }> {
  const campos = camposAnonimizacao(p.grupos)
  if (Object.keys(campos).length === 0) return { ok: true }

  const grupos = [...new Set([...(p.jaFeitos ?? []), ...p.grupos])]
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('guests')
    .update({
      ...campos,
      anonimizado_em: new Date().toISOString(),
      anonimizado_grupos: grupos,
      retencao_completa: TODOS_OS_GRUPOS.every(g => grupos.includes(g)),
    })
    .eq('id', p.guestId)

  if (error) {
    console.error('[retencao] anonimizar', p.guestId, error.message)
    return { ok: false, error: error.message }
  }

  // Apagar dados pessoais é irreversível: fica registado quem, quando e porquê.
  await logAudit({
    actorId: p.actorId,
    entidade: 'guest',
    entidadeId: p.guestId,
    acao: 'dados_anonimizados',
    detalhes: { grupos: p.grupos, motivo: p.motivo },
  })

  return { ok: true }
}

/**
 * Varre os hóspedes por tratar e anonimiza o que já passou do prazo.
 *
 * O prazo conta-se da **última saída** do hóspede, não da criação do registo:
 * quem volta reinicia a contagem, e uma reserva por cumprir não conta.
 * Reservas canceladas e no-shows são ignoradas — não houve estadia.
 *
 * @param ownerId limita a um anfitrião (para testes e execução manual)
 */
export async function aplicarRetencao(ownerId?: string): Promise<{
  avaliados: number
  anonimizados: number
  erros: number
}> {
  const supabase = createAdminClient()
  const hoje = today()

  let query = supabase
    .from('guests')
    .select('id, owner_id, criado_em, anonimizado_grupos')
    .eq('retencao_completa', false)
  if (ownerId) query = query.eq('owner_id', ownerId)

  const { data: hospedes, error } = await query
  if (error) {
    console.error('[retencao]', error.message)
    return { avaliados: 0, anonimizados: 0, erros: 1 }
  }
  if (!hospedes || hospedes.length === 0) {
    return { avaliados: 0, anonimizados: 0, erros: 0 }
  }

  const { saidas: ultimaSaida, completo } = await ultimasSaidas(hospedes.map(h => h.id))

  /* Sem a lista completa de saídas não se anonimiza nada.
   *
   * Um hóspede cuja reserva não veio na resposta parece não ter estadia
   * nenhuma, e o prazo passa a contar-se da criação da ficha — que pode ser
   * anos antes do check-out. O resultado seria apagar dados de documento cedo
   * de mais, sem volta e sem ninguém dar por isso.
   *
   * A rotina corre todos os dias: falhar hoje custa um dia de atraso numa
   * obrigação que se mede em anos. */
  if (!completo) {
    console.error('[retencao] leitura de saídas incompleta — nada foi anonimizado nesta execução')
    return { avaliados: hospedes.length, anonimizados: 0, erros: 1 }
  }

  let anonimizados = 0
  let erros = 0

  for (const hospede of hospedes as LinhaHospede[]) {
    const jaFeitos = hospede.anonimizado_grupos ?? []
    const { grupos } = avaliarRetencao(
      ultimaSaida.get(hospede.id) ?? null,
      hospede.criado_em?.slice(0, 10) ?? null,
      hoje,
    )

    const porFazer = grupos.filter(g => !jaFeitos.includes(g))
    if (porFazer.length === 0) continue

    const res = await anonimizarHospede({
      guestId: hospede.id,
      grupos: porFazer,
      jaFeitos,
      actorId: null,
      motivo: 'retencao',
    })
    if (res.ok) anonimizados++
    else erros++
  }

  return { avaliados: hospedes.length, anonimizados, erros }
}

/**
 * Check-out mais recente de cada hóspede, ignorando reservas sem estadia.
 *
 * Olha para os **dois** caminhos pelos quais uma pessoa está numa reserva:
 * `bookings.hospede_id` (quem reservou) e `reserva_hospedes` (quem lá dorme).
 * Um acompanhante nunca é o primeiro — desde que o boletim passou a ser por
 * pessoa, a maioria das pessoas de um grupo só existe no segundo. Sem ele, o
 * prazo caía para a data de criação da ficha e a política escrita
 * ("conta-se da última saída") deixava de descrever o que o código faz.
 *
 * ## Porque devolve `completo`
 *
 * Uma leitura falhada aqui não é uma leitura a menos: é um hóspede que passa a
 * parecer não ter estadia nenhuma. E quem chama recua então para a data de
 * criação da ficha, que pode ser **anos** antes do último check-out — e
 * anonimiza. Dados de documento apagados não voltam, e sem eles não há boletim
 * para comunicar.
 *
 * Por isso o erro sobe em vez de ser só registado. Adiar uma anonimização um
 * dia não custa nada; fazê-la um ano cedo de mais é irreversível.
 *
 * As leituras são paginadas pela mesma razão: o PostgREST corta às mil linhas
 * sem o dizer, e uma reserva que não venha na resposta é indistinguível de uma
 * reserva que não existe.
 */
async function ultimasSaidas(
  guestIds: string[],
): Promise<{ saidas: Map<string, string>; completo: boolean }> {
  const supabase = createAdminClient()
  const saidas = new Map<string, string>()
  let completo = true

  function registar(guestId: string, checkOut: string | null, estado: string) {
    if (!checkOut || ESTADOS_SEM_ESTADIA.includes(estado)) return
    const atual = saidas.get(guestId)
    if (!atual || checkOut > atual) saidas.set(guestId, checkOut)
  }

  // Em lotes: a lista de ids vai num `in`, que tem limite prático de tamanho.
  const LOTE = 200
  for (let i = 0; i < guestIds.length; i += LOTE) {
    const lote = guestIds.slice(i, i + LOTE)

    const [reservasRes, ligacoesRes] = await Promise.all([
      carregarTudo<{ hospede_id: string | null; check_out: string; estado: string }>(() =>
        supabase
          .from('bookings')
          .select('hospede_id, check_out, estado')
          .in('hospede_id', lote)
          .order('id', { ascending: true }),
      ),
      carregarTudo<{ guest_id: string; booking_id: string }>(() =>
        supabase
          .from('reserva_hospedes')
          .select('guest_id, booking_id')
          .in('guest_id', lote)
          .order('id', { ascending: true }),
      ),
    ])

    if (reservasRes.erro) {
      console.error('[retencao] saidas', reservasRes.erro)
      completo = false
    }

    for (const b of reservasRes.linhas) {
      if (b.hospede_id) registar(b.hospede_id, b.check_out, b.estado)
    }

    if (ligacoesRes.erro) {
      console.error('[retencao] ligacoes', ligacoesRes.erro)
      completo = false
    }
    const ligacoes = ligacoesRes.linhas
    if (ligacoes.length === 0) continue

    const bookingIds = [...new Set(ligacoes.map(l => l.booking_id))]
    const { linhas: reservasLigadas, erro: erroLigadas } = await carregarTudo<{
      id: string; check_out: string; estado: string
    }>(() =>
      supabase
        .from('bookings')
        .select('id, check_out, estado')
        .in('id', bookingIds)
        .order('id', { ascending: true }),
    )

    if (erroLigadas) {
      console.error('[retencao] reservas ligadas', erroLigadas)
      completo = false
      continue
    }

    const porId = new Map(reservasLigadas.map(b => [b.id, b]))

    for (const l of ligacoes) {
      const b = porId.get(l.booking_id)
      if (b) registar(l.guest_id, b.check_out, b.estado)
    }
  }

  return { saidas, completo }
}

export interface DadosExportados {
  gerado_em: string
  hospede: Record<string, unknown>
  reservas: Array<Record<string, unknown>>
  retencao: {
    politica: string
    anonimizado_em: string | null
    grupos_anonimizados: string[]
  }
}

/**
 * Todos os dados pessoais de um hóspede, para o direito de acesso e de
 * portabilidade (RGPD art. 15.º e 20.º).
 *
 * Devolve também as reservas, porque uma exportação que só desse a ficha do
 * hóspede omitiria metade do que se trata sobre ele. Os campos de faturação
 * ficam de fora: são dados do anfitrião sobre a transação, não do titular.
 */
export async function exportarDadosHospede(
  guestId: string,
  ownerId: string,
): Promise<{ dados?: DadosExportados; error?: string }> {
  const supabase = createAdminClient()

  const { data: hospede, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!hospede) return { error: 'nao_encontrado' }

  /* As estadias por **ambos** os caminhos.
   *
   * O export lia só `bookings.hospede_id` — quem reservou. Desde que o boletim
   * passou a ser por pessoa, a maioria das pessoas de um grupo existe apenas
   * em `reserva_hospedes`: um acompanhante recebia um ficheiro a dizer que não
   * tinha estadia nenhuma, e tinha. A rotina de retenção já olhava para os
   * dois caminhos; o direito de acesso é que ficou para trás — e é este que
   * tem um prazo legal em cima.
   *
   * Vai também o papel em cada reserva, porque «dormi lá» e «fui eu que
   * reservei» não são a mesma informação sobre a pessoa. */
  const { data: ligacoes } = await supabase
    .from('reserva_hospedes')
    .select('booking_id, principal')
    .eq('guest_id', guestId)
    .eq('owner_id', ownerId)

  const idsPorLigacao = (ligacoes ?? []).map(l => l.booking_id as string)

  const [proprias, acompanhadas] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, propriedade_id, check_in, check_out, num_hospedes, estado, origem, preco_total, notas, criado_em')
      .eq('hospede_id', guestId)
      .eq('owner_id', ownerId)
      .order('check_in', { ascending: true }),
    idsPorLigacao.length > 0
      ? supabase
          .from('bookings')
          .select('id, propriedade_id, check_in, check_out, num_hospedes, estado, origem, preco_total, notas, criado_em')
          .in('id', idsPorLigacao)
          .eq('owner_id', ownerId)
          .order('check_in', { ascending: true })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  type LinhaReserva = Record<string, unknown> & { id: string; check_in?: string | null }
  const doTitular = (proprias.data ?? []) as LinhaReserva[]
  const comoAcompanhante = (acompanhadas.data ?? []) as LinhaReserva[]

  const idsQueReservou = new Set(doTitular.map(b => b.id))
  const reservas: Array<Record<string, unknown>> = [
    ...doTitular.map(b => ({ ...b, papel: 'reservou' })),
    ...comoAcompanhante
      .filter(b => !idsQueReservou.has(b.id))
      .map(b => ({ ...b, papel: 'hospedou-se' })),
  ]
    /* Ordenação defensiva: uma linha sem data não pode derrubar um ficheiro
     * que a lei obriga a entregar em 30 dias. */
    .sort((a, b) => String(a.check_in ?? '').localeCompare(String(b.check_in ?? '')))

  // O titular tem direito aos dados, não ao criptograma (art. 15.º n.º 3:
  // "de forma inteligível").
  const { anonimizado_em, anonimizado_grupos, retencao_completa, ...dadosHospede } = revelarCampos(hospede)
  void retencao_completa // detalhe interno do varrimento, não interessa ao titular

  return {
    dados: {
      gerado_em: new Date().toISOString(),
      hospede: dadosHospede,
      reservas,
      retencao: {
        politica: 'Ver política de privacidade em /privacidade',
        anonimizado_em: anonimizado_em ?? null,
        grupos_anonimizados: anonimizado_grupos ?? [],
      },
    },
  }
}
