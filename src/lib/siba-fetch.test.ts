import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * Origem de dados do **CSV** do boletim e da submissão por web service.
 *
 * O CSV é o caminho que está em uso enquanto não houver credenciais de web
 * service — ou seja, é por aqui que os boletins são realmente comunicados
 * hoje. Exportava uma linha por reserva, quando o boletim é por pessoa: uma
 * reserva de oito comunicava uma e deixava sete por comunicar, a 100 a
 * 2.000 € de coima cada.
 */

const tabelas: Record<string, Array<Record<string, unknown>>> = {}

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    gte: (c: string, v: string) => { filtros.push(l => String(l[c]) >= v); return obj },
    lte: (c: string, v: string) => { filtros.push(l => String(l[c]) <= v); return obj },
    not: () => obj,
    order: () => obj,
    /* Como o PostgREST: devolve a fatia pedida. Sem isto o duplo aceitava
     * qualquer paginação e não provava nada sobre ela. */
    range: async (de: number, ate: number) => ({ data: alvo().slice(de, ate + 1), error: null }),
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('./supabase', () => ({
  createAdminClient: () => ({ from: (t: string) => ({ select: () => construtor(t) }) }),
}))

vi.mock('./campos-sensiveis', () => ({ revelarLista: (l: unknown[]) => l ?? [] }))

const { fetchSibaRowsForOwner } = await import('./siba-fetch')

function hospede(id: string, nome: string) {
  return {
    id, nome, data_nascimento: '1985-03-12', nacionalidade: 'Portugal',
    numero_documento: `doc-${id}`, tipo_documento: 'Cartão de Cidadão',
    data_validade_doc: '2030-01-01', sexo: 'F', pais_emissao: 'Portugal',
  }
}

beforeEach(() => {
  tabelas.bookings = [{
    id: 'b1', owner_id: 'user_1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: '2026-07-10', check_out: '2026-07-14', num_hospedes: 3, estado: 'checkout',
  }]
  tabelas.properties = [{ id: 'p1', nome: 'Quarto Familiar' }]
  tabelas.guests = [hospede('g1', 'Maria Silva'), hospede('g2', 'João Silva'), hospede('g3', 'Ana Silva')]
  tabelas.reserva_hospedes = [
    { booking_id: 'b1', guest_id: 'g1', principal: true, owner_id: 'user_1' },
    { booking_id: 'b1', guest_id: 'g2', principal: false, owner_id: 'user_1' },
    { booking_id: 'b1', guest_id: 'g3', principal: false, owner_id: 'user_1' },
  ]
})

describe('fetchSibaRowsForOwner', () => {
  it('devolve uma linha por pessoa, não por reserva', async () => {
    const { rows } = await fetchSibaRowsForOwner('user_1', '2026-07-01', '2026-07-31')

    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.nome).sort()).toEqual(['Ana Silva', 'João Silva', 'Maria Silva'])
    // Todas partilham a estadia e o alojamento.
    expect(rows.every(r => r.check_in === '2026-07-10' && r.alojamento === 'Quarto Familiar')).toBe(true)
  })

  it('cada linha leva o documento da própria pessoa', async () => {
    const { rows } = await fetchSibaRowsForOwner('user_1', '2026-07-01', '2026-07-31')
    const docs = rows.map(r => r.numero_documento).sort()
    expect(docs).toEqual(['doc-g1', 'doc-g2', 'doc-g3'])
  })

  it('uma reserva sem fichas próprias entra na mesma, por quem reservou', async () => {
    // Rede de segurança para reservas anteriores à tabela de ligação: sem
    // isto desapareciam do ficheiro em vez de aparecerem incompletas.
    tabelas.reserva_hospedes = []
    const { rows } = await fetchSibaRowsForOwner('user_1', '2026-07-01', '2026-07-31')

    expect(rows).toHaveLength(1)
    expect(rows[0].nome).toBe('Maria Silva')
  })

  it('não leva hóspedes de reservas de outro anfitrião', async () => {
    tabelas.bookings = [{ ...tabelas.bookings[0], owner_id: 'user_2' }]
    const { rows } = await fetchSibaRowsForOwner('user_1', '2026-07-01', '2026-07-31')
    expect(rows).toHaveLength(0)
  })

  it('respeita o período pedido', async () => {
    const { rows } = await fetchSibaRowsForOwner('user_1', '2026-08-01', '2026-08-31')
    expect(rows).toHaveLength(0)
  })

  it('sem reservas devolve vazio sem ir buscar mais nada', async () => {
    tabelas.bookings = []
    const { rows, error } = await fetchSibaRowsForOwner('user_1', '2026-07-01', '2026-07-31')
    expect(rows).toEqual([])
    expect(error).toBeUndefined()
  })
})
