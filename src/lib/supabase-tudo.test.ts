import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { carregarTudo } = await import('./supabase-tudo')

/** Um PostgREST de mentira: nunca devolve mais de 1000 linhas por pedido. */
function base(total: number, erroNaPagina?: number) {
  const pedidos: Array<[number, number]> = []
  const construir = () => ({
    range: async (de: number, ate: number) => {
      pedidos.push([de, ate])
      if (erroNaPagina !== undefined && pedidos.length === erroNaPagina) {
        return { data: null, error: { message: 'ligação perdida' } }
      }
      const fim = Math.min(ate + 1, total)
      const linhas = de >= total ? [] : Array.from({ length: fim - de }, (_, i) => ({ n: de + i }))
      return { data: linhas.slice(0, 1000), error: null }
    },
  })
  return { construir, pedidos }
}

describe('carregarTudo', () => {
  it('traz tudo quando há mais do que o corte do PostgREST', async () => {
    /* O corte é real e silencioso: 2500 linhas pedidas neste projeto,
     * 1000 devolvidas, resposta 200 e nenhum aviso. */
    const { construir, pedidos } = base(2500)
    const { linhas } = await carregarTudo<{ n: number }>(construir)

    expect(linhas).toHaveLength(2500)
    expect(linhas[0].n).toBe(0)
    expect(linhas[2499].n).toBe(2499)
    expect(pedidos).toHaveLength(3)
  })

  it('uma página incompleta termina a leitura — não se pede o que não existe', async () => {
    const { construir, pedidos } = base(300)
    const { linhas } = await carregarTudo(construir)

    expect(linhas).toHaveLength(300)
    expect(pedidos).toHaveLength(1)
  })

  it('exatamente 1000 linhas obriga a confirmar que não há mais', async () => {
    // O caso que engana: uma página cheia é indistinguível de fim de dados.
    const { construir, pedidos } = base(1000)
    const { linhas } = await carregarTudo(construir)

    expect(linhas).toHaveLength(1000)
    expect(pedidos).toHaveLength(2)
  })

  it('sem linhas nenhumas devolve vazio', async () => {
    const { linhas, erro } = await carregarTudo(base(0).construir)
    expect(linhas).toEqual([])
    expect(erro).toBeUndefined()
  })

  it('um erro a meio devolve o erro e o que já se leu — não finge que está completo', async () => {
    const { construir } = base(2500, 2)
    const { linhas, erro } = await carregarTudo<{ n: number }>(construir)

    expect(erro).toBe('ligação perdida')
    expect(linhas).toHaveLength(1000)
  })

  it('constrói a consulta outra vez em cada página', async () => {
    /* Um construtor do supabase-js não se reutiliza depois de executado:
     * reaproveitá-lo devolvia a mesma página vezes sem conta, e o ciclo só
     * parava no teto. */
    let construcoes = 0
    await carregarTudo(() => {
      construcoes++
      return base(2500).construir()
    })
    expect(construcoes).toBe(3)
  })

  it('o teto trava um ciclo infinito', async () => {
    // Uma base que responda sempre cheio não pode pendurar o pedido.
    const semFim = () => ({
      range: async (de: number) => ({
        data: Array.from({ length: 1000 }, (_, i) => ({ n: de + i })),
        error: null,
      }),
    })
    const { linhas } = await carregarTudo<{ n: number }>(semFim, 3000)
    expect(linhas).toHaveLength(3000)
  })
})
