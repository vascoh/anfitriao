import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

/**
 * Duplo da base de dados que **respeita os filtros**.
 *
 * Um duplo que devolve sempre a mesma linha faria os testes de propriedade
 * passar sem provar nada: o guarda existe precisamente para distinguir a
 * linha de um anfitrião da de outro, e isso só se vê se o `eq('id', …)` for
 * levado a sério.
 */
const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; row: Record<string, unknown> }> = []

function construtor(tabela: string) {
  const filtros: Array<[string, unknown]> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(([c, v]) => l[c] === v))

  const obj = {
    eq: (coluna: string, valor: unknown) => { filtros.push([coluna, valor]); return obj },
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    single: async () => {
      const linha = alvo()[0]
      return linha ? { data: linha, error: null } : { data: null, error: { message: 'not found' } }
    },
    order: () => obj,
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      upsert: async (row: Record<string, unknown>) => {
        escritas.push({ tabela, row })
        return { error: null }
      },
      delete: () => construtor(tabela),
    }),
  }),
}))

let utilizador: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: utilizador }),
}))

const { POST } = await import('./route')

function pedido(corpo: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

const RESERVA = {
  id: 'b-nova',
  propriedade_id: 'p-minha',
  hospede_id: 'g-meu',
  check_in: '2026-09-01',
  check_out: '2026-09-04',
  num_hospedes: 2,
  estado: 'confirmada',
  preco_total: 300,
}

beforeEach(() => {
  utilizador = 'user_1'
  escritas.length = 0
  tabelas.properties = [
    { id: 'p-minha', owner_id: 'user_1' },
    { id: 'p-do-vizinho', owner_id: 'user_2' },
    { id: 'p-sem-dono', owner_id: null },
  ]
  tabelas.guests = [
    { id: 'g-meu', owner_id: 'user_1' },
    { id: 'g-do-vizinho', owner_id: 'user_2' },
  ]
  tabelas.bookings = [
    { id: 'b-minha', owner_id: 'user_1' },
    { id: 'b-do-vizinho', owner_id: 'user_2' },
  ]
})

describe('POST /api/bookings', () => {
  it('cria uma reserva no alojamento do próprio', async () => {
    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(200)
    expect(escritas[0].row.owner_id).toBe('user_1')
  })

  it('recusa reservar no alojamento de outro anfitrião', async () => {
    /* O id de uma propriedade é público — está no URL de /book/[id]. Sem este
     * guarda, uma conta grátis bloqueava o calendário do vizinho: o
     * `hasConflict` procura por propriedade e não por dono, e ele não via
     * nada, porque o calendário dele só mostra as reservas dele. */
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-do-vizinho' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })

  it('recusa uma propriedade que não existe', async () => {
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-inventada' }))
    expect(res.status).toBe(404)
  })

  it('aceita uma propriedade sem dono (legado)', async () => {
    const res = await POST(pedido({ ...RESERVA, propriedade_id: 'p-sem-dono' }))
    expect(res.status).toBe(200)
  })

  it('recusa sobrepor a reserva de outro anfitrião', async () => {
    const res = await POST(pedido({ ...RESERVA, id: 'b-do-vizinho' }))
    expect(res.status).toBe(403)
    expect(escritas).toHaveLength(0)
  })

  it('deixa alterar uma reserva própria', async () => {
    const res = await POST(pedido({ ...RESERVA, id: 'b-minha' }))
    expect(res.status).toBe(200)
  })

  it('recusa ligar a ficha de um hóspede de outro anfitrião', async () => {
    // Uma reserva não empresta o acesso aos dados de quem é cliente de outro.
    const res = await POST(pedido({ ...RESERVA, hospede_id: 'g-do-vizinho' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })

  it('o owner_id é sempre o da sessão, não o que vier no corpo', async () => {
    const res = await POST(pedido({ ...RESERVA, owner_id: 'user_2' }))
    expect(res.status).toBe(200)
    expect(escritas[0].row.owner_id).toBe('user_1')
  })

  it('sem sessão não escreve nada', async () => {
    utilizador = null
    const res = await POST(pedido(RESERVA))
    expect(res.status).toBe(401)
    expect(escritas).toHaveLength(0)
  })

  it('JSON inválido não rebenta a rota', async () => {
    const req = new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: 'isto não é json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
