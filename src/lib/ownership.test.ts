import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('server-only', () => ({}))

const { canUpsertRow, ownsProperty } = await import('./ownership')

/** Cliente falso: devolve a linha pedida, ou nada quando não existe. */
function clienteCom(linhas: Record<string, { owner_id: string | null } | undefined>) {
  return {
    from: (tabela: string) => ({
      select: () => ({
        eq: (_coluna: string, id: string) => ({
          maybeSingle: async () => ({ data: linhas[`${tabela}:${id}`] ?? null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('canUpsertRow', () => {
  it('deixa criar uma linha nova', async () => {
    const c = clienteCom({})
    expect(await canUpsertRow(c, 'tarifas', 'nova', 'user_1')).toBe(true)
  })

  it('deixa alterar o que é meu', async () => {
    const c = clienteCom({ 'tarifas:t1': { owner_id: 'user_1' } })
    expect(await canUpsertRow(c, 'tarifas', 't1', 'user_1')).toBe(true)
  })

  it('recusa a linha de outro anfitrião', async () => {
    /* Sem isto, mandar o id de uma linha alheia sobrepunha-a — e como o
     * owner_id é forçado para o de quem escreve, ficava também com ela. */
    const c = clienteCom({ 'tarifas:t1': { owner_id: 'user_2' } })
    expect(await canUpsertRow(c, 'tarifas', 't1', 'user_1')).toBe(false)
  })

  it('uma linha sem dono pode ser reclamada (legado)', async () => {
    const c = clienteCom({ 'tarifas:t1': { owner_id: null } })
    expect(await canUpsertRow(c, 'tarifas', 't1', 'user_1')).toBe(true)
  })

  it('sem id não há nada a proteger', async () => {
    const c = clienteCom({})
    expect(await canUpsertRow(c, 'tarifas', undefined, 'user_1')).toBe(true)
    expect(await canUpsertRow(c, 'tarifas', '', 'user_1')).toBe(true)
  })
})

describe('ownsProperty', () => {
  it('aceita o alojamento do próprio', async () => {
    const c = clienteCom({ 'properties:p1': { owner_id: 'user_1' } })
    expect(await ownsProperty(c, 'p1', 'user_1')).toBe(true)
  })

  it('recusa o alojamento de outro — o id é público', async () => {
    /* O id de uma propriedade está no URL de /book/[id]. Sem esta verificação,
     * criar reservas no alojamento do vizinho fazia o site dele responder
     * "datas ocupadas" a toda a gente, sem ele ver porquê. */
    const c = clienteCom({ 'properties:p1': { owner_id: 'user_2' } })
    expect(await ownsProperty(c, 'p1', 'user_1')).toBe(false)
  })

  it('recusa um alojamento que não existe', async () => {
    // Ao contrário de canUpsertRow: aqui a referência tem de apontar para
    // alguma coisa real, senão é lixo ou uma tentativa às cegas.
    const c = clienteCom({})
    expect(await ownsProperty(c, 'inexistente', 'user_1')).toBe(false)
  })

  it('um alojamento sem dono pode ser usado (legado)', async () => {
    const c = clienteCom({ 'properties:p1': { owner_id: null } })
    expect(await ownsProperty(c, 'p1', 'user_1')).toBe(true)
  })

  it('sem referência não há nada a validar', async () => {
    const c = clienteCom({})
    expect(await ownsProperty(c, null, 'user_1')).toBe(true)
    expect(await ownsProperty(c, undefined, 'user_1')).toBe(true)
  })
})
