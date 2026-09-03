import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

let definicoes: Record<string, unknown> | null = null

/* O duplo guarda **por que filtro** a escrita passou.
 *
 * Antes, o `update` era `eq: async () => …`: ignorava a coluna e o valor. Um
 * teste não conseguia distinguir «atualiza as definições deste anfitrião» de
 * «atualiza as de toda a gente» — e o slug do site é único entre contas, o que
 * torna esta a escrita com mais consequência de cruzar inquilinos. */
const escritas: Array<{
  tipo: 'insert' | 'update'
  row: Record<string, unknown>
  filtros?: Array<[string, unknown]>
}> = []

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: definicoes, error: null }) }) }),
      insert: async (row: Record<string, unknown>) => { escritas.push({ tipo: 'insert', row }); return { error: null } },
      update: (row: Record<string, unknown>) => {
        const filtros: Array<[string, unknown]> = []
        const alvo = {
          eq: (coluna: string, valor: unknown) => {
            filtros.push([coluna, valor])
            escritas.push({ tipo: 'update', row, filtros })
            return Promise.resolve({ error: null })
          },
        }
        return alvo
      },
    }),
  }),
}))

let utilizador: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: utilizador }) }))

let propriedades: Array<Record<string, unknown>> = []
vi.mock('@/lib/db-admin', () => ({
  adminGetWebsiteSettings: async () => definicoes,
  adminGetProperties: async () => propriedades,
}))

const { POST } = await import('./route')

function pedido(corpo: unknown) {
  return new NextRequest('http://localhost/api/website-settings', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

/** Definições que cumprem o essencial para publicar. */
const PRONTAS = {
  nome: 'Casa de Vasco',
  slug: 'casadevasco',
  email: 'vasco@exemplo.pt',
  enabled: false,
}

beforeEach(() => {
  utilizador = 'user_1'
  definicoes = null
  escritas.length = 0
  propriedades = [{ id: 'p1', ativo: true, imagem_url: 'https://exemplo/foto.jpg' }]
})

describe('POST /api/website-settings — endereço', () => {
  it('normaliza o endereço em vez de guardar o que vier', async () => {
    await POST(pedido({ ...PRONTAS, slug: '  Casa da Praça!! ' }))
    expect(escritas[0].row.slug).toBe('casa-da-praca')
  })

  it('o endereço vazio é null, não cadeia vazia', async () => {
    /* A coluna tem UNIQUE: duas cadeias vazias colidem, dois NULL não. Com
     * `''`, o segundo cliente que apagasse o endereço deixava de conseguir
     * gravar a página inteira. */
    await POST(pedido({ ...PRONTAS, slug: '', enabled: false }))
    expect(escritas[0].row.slug).toBeNull()
  })

  it('recusa endereços curtos de mais', async () => {
    const res = await POST(pedido({ ...PRONTAS, slug: 'ab' }))
    expect(res.status).toBe(400)
    expect(escritas).toHaveLength(0)
  })

  it('só escreve campos conhecidos', async () => {
    // Guardava-se `{ ...body }`, incluindo o `id` — a chave primária.
    await POST(pedido({ ...PRONTAS, id: 999, owner_id: 'user_2', coluna_inventada: 'x' }))
    const row = escritas[0].row
    expect(row.id).toBeUndefined()
    expect(row.coluna_inventada).toBeUndefined()
    expect(row.owner_id).toBe('user_1')
  })
})

describe('POST /api/website-settings — publicar', () => {
  it('publica quando o essencial está preenchido', async () => {
    const res = await POST(pedido({ ...PRONTAS, enabled: true }))
    expect(res.status).toBe(200)
    expect(escritas[0].row.enabled).toBe(true)
  })

  it('recusa publicar com o nome de fábrica', async () => {
    const res = await POST(pedido({ ...PRONTAS, nome: 'Reservas Diretas', enabled: true }))
    expect(res.status).toBe(400)
    expect((await res.json()).emFalta).toContain('nome')
    expect(escritas).toHaveLength(0)
  })

  it('recusa publicar sem contacto', async () => {
    const res = await POST(pedido({ ...PRONTAS, email: '', telefone: '', enabled: true }))
    expect((await res.json()).emFalta).toContain('contacto')
  })

  it('recusa publicar sem uma única foto', async () => {
    propriedades = [{ id: 'p1', ativo: true }]
    const res = await POST(pedido({ ...PRONTAS, enabled: true }))
    expect((await res.json()).emFalta).toContain('foto')
  })

  it('um site já publicado continua a poder ser guardado como está', async () => {
    /* A regra aperta na passagem para publicado, não sobre o que já existe —
     * senão trancava o anfitrião fora das suas próprias definições por uma
     * regra que ele não sabia que existia. É o caso da primeira conta real,
     * que está no ar com o nome de fábrica. */
    definicoes = { id: 1, enabled: true, nome: 'Reservas Diretas', slug: 'casadevasco', email: 'v@exemplo.pt' }
    const res = await POST(pedido({ nome: 'Reservas Diretas', slug: 'casadevasco', email: 'v@exemplo.pt', enabled: true }))
    expect(res.status).toBe(200)
  })

  it('despublicar é sempre permitido', async () => {
    definicoes = { id: 1, enabled: true, nome: 'Reservas Diretas', slug: 'casadevasco' }
    const res = await POST(pedido({ nome: 'Reservas Diretas', slug: 'casadevasco', enabled: false }))
    expect(res.status).toBe(200)
  })

  it('verifica o estado final, não só o que vem no pedido', async () => {
    // Envio parcial: o nome já está gravado e não vem no corpo.
    definicoes = { id: 1, enabled: false, nome: 'Casa de Vasco', slug: 'casadevasco', email: 'v@exemplo.pt' }
    const res = await POST(pedido({ enabled: true }))
    expect(res.status).toBe(200)
  })

  it('sem sessão não escreve nada', async () => {
    utilizador = null
    const res = await POST(pedido(PRONTAS))
    expect(res.status).toBe(401)
    expect(escritas).toHaveLength(0)
  })
})

describe('isolamento entre contas', () => {
  /**
   * O slug é único entre contas e o site é público: uma escrita que não filtre
   * por dono não estraga só as definições de quem a fez.
   *
   * Este teste existe porque o duplo antigo ignorava o filtro do `update` — o
   * código estava certo, mas nada o segurava. Apagar o `.eq('owner_id', …)` da
   * rota passava despercebido a toda a suite.
   */
  it('a atualização é filtrada pelo dono da sessão', async () => {
    definicoes = { owner_id: 'user_1', nome: 'Casa' }

    await POST(pedido({ nome: 'Casa Nova' }))

    const update = escritas.find(e => e.tipo === 'update')
    expect(update, 'não houve update para verificar').toBeDefined()
    expect(update?.filtros).toContainEqual(['owner_id', 'user_1'])
  })

  it('o owner_id gravado é o da sessão, não o que vier no corpo', async () => {
    definicoes = { owner_id: 'user_1', nome: 'Casa' }

    await POST(pedido({ nome: 'Casa', owner_id: 'user_2' }))

    const escrita = escritas.at(-1)
    if (escrita && 'owner_id' in escrita.row) {
      expect(escrita.row.owner_id).toBe('user_1')
    }
  })
})
