import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<Record<string, unknown>> = []

/** Duplo que respeita os filtros — ver a nota em `bookings/route.test.ts`. */
function construtor(tabela: string) {
  const filtros: Array<[string, unknown]> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(([c, v]) => l[c] === v))

  const obj = {
    eq: (coluna: string, valor: unknown) => { filtros.push([coluna, valor]); return obj },
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    single: async () => ({ data: alvo()[0] ?? null, error: alvo()[0] ? null : { message: 'not found' } }),
    order: () => obj,
    then: (resolve: (v: { data: unknown; error: null }) => unknown) => resolve({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      upsert: async (row: Record<string, unknown>) => { escritas.push(row); return { error: null } },
      delete: () => construtor(tabela),
    }),
  }),
}))

let utilizador: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: utilizador }) }))

let conta: Record<string, unknown> | null = { id: 'acc_1', propriedades_max: 3 }
vi.mock('@/lib/accounts', () => ({
  getAccountByClerkId: async () => conta,
}))

vi.mock('@/lib/audit', () => ({ logAudit: async () => {} }))

const { POST } = await import('./route')

function pedido(corpo: unknown) {
  return new NextRequest('http://localhost/api/properties', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

const NOVA = { nome: 'T1 Amora', tipo: 'apartamento', capacidade: 2, preco_base: 80, ativo: true }

beforeEach(() => {
  utilizador = 'user_1'
  conta = { id: 'acc_1', propriedades_max: 3 }
  escritas.length = 0
  tabelas.properties = [
    { id: 'p1', owner_id: 'user_1', parent_id: null, ativo: true },
    { id: 'casa-do-vizinho', owner_id: 'user_2', parent_id: null, ativo: true },
  ]
})

describe('POST /api/properties', () => {
  it('cria uma propriedade nova', async () => {
    const res = await POST(pedido(NOVA))
    expect(res.status).toBe(200)
    expect(escritas[0].owner_id).toBe('user_1')
  })

  it('recusa alterar a propriedade de outro anfitrião', async () => {
    const res = await POST(pedido({ ...NOVA, id: 'casa-do-vizinho' }))
    expect(res.status).toBe(403)
    expect(escritas).toHaveLength(0)
  })

  it('recusa declarar-se quarto da casa de outro', async () => {
    /* Sem isto, o intruso injetava datas ocupadas no feed iCal que a vítima
     * publica nas plataformas — o export agrega os quartos da casa. */
    const res = await POST(pedido({ ...NOVA, parent_id: 'casa-do-vizinho' }))
    expect(res.status).toBe(404)
    expect(escritas).toHaveLength(0)
  })

  it('aceita um quarto da própria casa', async () => {
    const res = await POST(pedido({ ...NOVA, parent_id: 'p1' }))
    expect(res.status).toBe(200)
  })

  it('bloqueia quando o plano está cheio', async () => {
    tabelas.properties = [
      { id: 'a', owner_id: 'user_1', parent_id: null, ativo: true },
      { id: 'b', owner_id: 'user_1', parent_id: null, ativo: true },
      { id: 'c', owner_id: 'user_1', parent_id: null, ativo: true },
    ]
    const res = await POST(pedido(NOVA))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('LIMIT_REACHED')
  })

  it('o primeiro quarto de uma casa não gasta unidade nenhuma', async () => {
    // A casa deixa de ser alugável no momento em que o quarto passa a sê-lo.
    tabelas.properties = [
      { id: 'casa', owner_id: 'user_1', parent_id: null, ativo: true },
      { id: 'b', owner_id: 'user_1', parent_id: null, ativo: true },
      { id: 'c', owner_id: 'user_1', parent_id: null, ativo: true },
    ]
    const res = await POST(pedido({ ...NOVA, parent_id: 'casa' }))
    expect(res.status).toBe(200)
  })

  it('reativar um quarto desativado também passa pelo limite', async () => {
    /* A verificação só corria nas criações: quem chegasse ao teto desativava
     * um quarto, criava outro e reativava o primeiro. */
    tabelas.properties = [
      { id: 'casa', owner_id: 'user_1', parent_id: null, ativo: true },
      { id: 'q1', owner_id: 'user_1', parent_id: 'casa', ativo: true },
      { id: 'q2', owner_id: 'user_1', parent_id: 'casa', ativo: true },
      { id: 'q3', owner_id: 'user_1', parent_id: 'casa', ativo: false },
    ]
    conta = { id: 'acc_1', propriedades_max: 2 }

    const res = await POST(pedido({ ...NOVA, id: 'q3', parent_id: 'casa', ativo: true }))
    expect(res.status).toBe(403)
    expect(escritas).toHaveLength(0)
  })

  it('sem sessão não escreve nada', async () => {
    utilizador = null
    const res = await POST(pedido(NOVA))
    expect(res.status).toBe(401)
    expect(escritas).toHaveLength(0)
  })

  it('sem conta não escreve nada', async () => {
    conta = null
    const res = await POST(pedido(NOVA))
    expect(res.status).toBe(404)
  })
})
