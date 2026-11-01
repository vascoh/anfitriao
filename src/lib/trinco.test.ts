import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/** Imitação da base: uma tabela de trincos com prazo, como a da migração 055. */
const trincos = new Map<string, string>()
let falharAdquirir = false
const chamadas: string[] = []

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, a: { p_chave: string; p_dono: string }) => {
      chamadas.push(fn)
      if (fn === 'adquirir_trinco') {
        if (falharAdquirir) return { data: null, error: { message: 'base em baixo' } }
        if (trincos.has(a.p_chave)) return { data: false, error: null }
        trincos.set(a.p_chave, a.p_dono)
        return { data: true, error: null }
      }
      if (trincos.get(a.p_chave) === a.p_dono) trincos.delete(a.p_chave)
      return { data: null, error: null }
    },
  }),
}))

const { comTrinco } = await import('./trinco')

beforeEach(() => { trincos.clear(); falharAdquirir = false; chamadas.length = 0 })

describe('comTrinco', () => {
  it('corre e liberta no fim', async () => {
    const r = await comTrinco('k', 60, async () => 42)
    expect(r).toEqual({ obtido: true, valor: 42 })
    expect(trincos.size).toBe(0)
  })

  it('uma segunda passagem ao mesmo tempo não corre', async () => {
    let soltar!: () => void
    const primeira = comTrinco('k', 60, () => new Promise<string>(r => { soltar = () => r('1.ª') }))
    await vi.waitFor(() => expect(trincos.has('k')).toBe(true))

    const fn = vi.fn(async () => '2.ª')
    expect(await comTrinco('k', 60, fn)).toEqual({ obtido: false })
    expect(fn).not.toHaveBeenCalled()

    soltar()
    expect(await primeira).toEqual({ obtido: true, valor: '1.ª' })
    expect(trincos.size).toBe(0)
  })

  it('liberta mesmo quando a função rebenta', async () => {
    await expect(comTrinco('k', 60, async () => { throw new Error('x') })).rejects.toThrow('x')
    expect(trincos.size).toBe(0)
  })

  it('com a base em baixo, corre na mesma (o índice único é a rede)', async () => {
    falharAdquirir = true
    expect(await comTrinco('k', 60, async () => 'ok')).toEqual({ obtido: true, valor: 'ok' })
    expect(chamadas).toEqual(['adquirir_trinco'])
  })

  it('com espera, a segunda passagem corre depois da primeira em vez de desistir', async () => {
    let soltar!: () => void
    const ordem: string[] = []
    const primeira = comTrinco('k', 60, () => new Promise<void>(r => { soltar = () => { ordem.push('1.ª'); r() } }))
    await vi.waitFor(() => expect(trincos.has('k')).toBe(true))

    const segunda = comTrinco('k', 60, async () => { ordem.push('2.ª') }, { esperarMs: 2000 })
    setTimeout(() => soltar(), 300)

    expect((await segunda).obtido).toBe(true)
    await primeira
    expect(ordem).toEqual(['1.ª', '2.ª'])
  })
})
