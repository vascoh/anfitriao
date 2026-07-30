import 'server-only'
import { createAdminClient } from './supabase'
import { logAudit } from './audit'
import { today } from './utils'
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

  const ultimaSaida = await ultimasSaidas(hospedes.map(h => h.id))

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

/** Check-out mais recente de cada hóspede, ignorando reservas sem estadia. */
async function ultimasSaidas(guestIds: string[]): Promise<Map<string, string>> {
  const supabase = createAdminClient()
  const saidas = new Map<string, string>()

  // Em lotes: a lista de ids vai num `in`, que tem limite prático de tamanho.
  const LOTE = 200
  for (let i = 0; i < guestIds.length; i += LOTE) {
    const { data, error } = await supabase
      .from('bookings')
      .select('hospede_id, check_out, estado')
      .in('hospede_id', guestIds.slice(i, i + LOTE))

    if (error) {
      console.error('[retencao] saidas', error.message)
      continue
    }

    for (const b of data ?? []) {
      if (!b.hospede_id || !b.check_out) continue
      if (ESTADOS_SEM_ESTADIA.includes(b.estado)) continue
      const atual = saidas.get(b.hospede_id)
      if (!atual || b.check_out > atual) saidas.set(b.hospede_id, b.check_out)
    }
  }

  return saidas
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

  const { data: reservas } = await supabase
    .from('bookings')
    .select('id, propriedade_id, check_in, check_out, num_hospedes, estado, origem, preco_total, notas, criado_em')
    .eq('hospede_id', guestId)
    .eq('owner_id', ownerId)
    .order('check_in', { ascending: true })

  const { anonimizado_em, anonimizado_grupos, retencao_completa, ...dadosHospede } = hospede
  void retencao_completa // detalhe interno do varrimento, não interessa ao titular

  return {
    dados: {
      gerado_em: new Date().toISOString(),
      hospede: dadosHospede,
      reservas: reservas ?? [],
      retencao: {
        politica: 'Ver política de privacidade em /privacidade',
        anonimizado_em: anonimizado_em ?? null,
        grupos_anonimizados: anonimizado_grupos ?? [],
      },
    },
  }
}
