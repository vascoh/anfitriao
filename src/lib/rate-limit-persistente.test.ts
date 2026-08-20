import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/** Contagem partilhada, como a da base: uma só, para todas as instâncias. */
let contagens: Record<string, number> = {}
let falhaDaBase: { message: string } | null = null

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    rpc: async (_f: string, p: { p_chave: string; p_limite: number; p_janela_ms: number }) => {
      if (falhaDaBase) return { data: null, error: falhaDaBase }
      contagens[p.p_chave] = (contagens[p.p_chave] ?? 0) + 1
      const n = contagens[p.p_chave]
      return {
        data: {
          permitido: n <= p.p_limite,
          restantes: Math.max(0, p.p_limite - n),
          reinicia_em: 1_000_000,
        },
        error: null,
      }
    },
  }),
}))

/* A porta em memória fica sempre aberta neste teste: o que se quer provar é o
 * comportamento da contagem partilhada, e o `Map` do módulo real guardava
 * estado entre testes. */
vi.mock('./rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 99, resetAt: 0 }),
}))

const { verificarLimite } = await import('./rate-limit-persistente')

beforeEach(() => { contagens = {}; falhaDaBase = null })

describe('verificarLimite', () => {
  it('deixa passar dentro do limite', async () => {
    const r = await verificarLimite('checkin:1.2.3.4', 3, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('recusa a partir do pedido que passa do limite', async () => {
    for (let i = 0; i < 3; i++) await verificarLimite('checkin:1.2.3.4', 3, 60_000)
    expect((await verificarLimite('checkin:1.2.3.4', 3, 60_000)).allowed).toBe(false)
  })

  it('conta em conjunto o que várias instâncias viram separadamente', async () => {
    /* É o defeito medido em produção: 90 pedidos em paralelo com limite de 60
     * passaram todos, porque cada instância contava para o seu lado. Com a
     * contagem na base, os mesmos 90 pedidos dão 60 aceites e 30 recusados,
     * venham de onde vierem. */
    const respostas = []
    for (let i = 0; i < 90; i++) respostas.push(await verificarLimite('checkin:1.2.3.4', 60, 3_600_000))

    expect(respostas.filter(r => r.allowed)).toHaveLength(60)
    expect(respostas.filter(r => !r.allowed)).toHaveLength(30)
  })

  it('chaves diferentes não se estorvam', async () => {
    for (let i = 0; i < 3; i++) await verificarLimite('checkin:1.1.1.1', 3, 60_000)
    expect((await verificarLimite('checkin:2.2.2.2', 3, 60_000)).allowed).toBe(true)
  })

  it('com a base em baixo deixa passar em vez de trancar toda a gente', async () => {
    /* Fechar a porta aqui trancava o check-in de todos os hóspedes de todos os
     * anfitriões por causa de uma tabela auxiliar. Fica a porta em memória,
     * que é o que existia antes disto. */
    falhaDaBase = { message: 'connection failure' }
    expect((await verificarLimite('checkin:1.2.3.4', 1, 60_000)).allowed).toBe(true)
  })
})
