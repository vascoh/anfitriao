import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const toasts: Array<{ tipo: string; texto: string }> = []
vi.mock('sonner', () => ({
  toast: {
    error: (texto: string) => { toasts.push({ tipo: 'error', texto }) },
    success: (texto: string) => { toasts.push({ tipo: 'success', texto }) },
  },
}))

const { guardar, eliminar, guardarComResposta } = await import('./guardar')

const fetchFalso = vi.fn()
beforeEach(() => {
  toasts.length = 0
  fetchFalso.mockReset()
  vi.stubGlobal('fetch', fetchFalso)
})

function resposta(ok: boolean, corpo: unknown = {}) {
  return { ok, json: async () => corpo } as unknown as Response
}

describe('guardar', () => {
  it('devolve true quando a escrita chega ao fim', async () => {
    fetchFalso.mockResolvedValue(resposta(true))
    expect(await guardar('/api/x', { a: 1 })).toBe(true)
    expect(toasts).toHaveLength(0)
  })

  it('devolve false e mostra o motivo do servidor', async () => {
    /* O servidor já explicava tudo — "Limite do teu plano atingido (3/3
     * alojamentos)" — e ninguém lia a resposta. O ecrã dizia "Guardado". */
    fetchFalso.mockResolvedValue(resposta(false, { error: 'Limite do teu plano atingido (3/3 alojamentos).' }))

    expect(await guardar('/api/properties', {})).toBe(false)
    expect(toasts[0].tipo).toBe('error')
    expect(toasts[0].texto).toContain('3/3')
  })

  it('sem mensagem do servidor, diz alguma coisa na mesma', async () => {
    fetchFalso.mockResolvedValue(resposta(false))
    await guardar('/api/x', {})
    expect(toasts[0].texto).toBeTruthy()
  })

  it('distingue falta de rede de recusa do servidor', async () => {
    // Faz diferença: sem rede vale a pena tentar outra vez, recusado não.
    fetchFalso.mockRejectedValue(new Error('offline'))
    expect(await guardar('/api/x', {})).toBe(false)
    expect(toasts[0].texto).toMatch(/ligação|internet/i)
  })

  it('em modo silencioso não incomoda quem trata do erro por si', async () => {
    fetchFalso.mockResolvedValue(resposta(false, { error: 'não' }))
    expect(await guardar('/api/x', {}, { silencioso: true })).toBe(false)
    expect(toasts).toHaveLength(0)
  })

  it('manda o corpo em JSON', async () => {
    fetchFalso.mockResolvedValue(resposta(true))
    await guardar('/api/x', { nome: 'Casa' })
    const [, opcoes] = fetchFalso.mock.calls[0]
    expect(opcoes.method).toBe('POST')
    expect(JSON.parse(opcoes.body)).toEqual({ nome: 'Casa' })
  })
})

describe('eliminar', () => {
  it('não manda corpo nenhum', async () => {
    fetchFalso.mockResolvedValue(resposta(true))
    await eliminar('/api/x?id=1')
    const [, opcoes] = fetchFalso.mock.calls[0]
    expect(opcoes.method).toBe('DELETE')
    expect(opcoes.body).toBeUndefined()
  })

  it('mostra a recusa — uma eliminação recusada parecia uma eliminação feita', async () => {
    fetchFalso.mockResolvedValue(resposta(false, { error: 'Este alojamento tem 2 faturas emitidas.' }))
    expect(await eliminar('/api/properties?id=1')).toBe(false)
    expect(toasts[0].texto).toContain('faturas')
  })
})

describe('guardarComResposta', () => {
  it('devolve o corpo quando corre bem', async () => {
    fetchFalso.mockResolvedValue(resposta(true, { grupoId: 'g1' }))
    expect(await guardarComResposta<{ grupoId: string }>('/api/x', {})).toEqual({ grupoId: 'g1' })
  })

  it('devolve null quando o servidor recusa', async () => {
    fetchFalso.mockResolvedValue(resposta(false, { error: 'não cabem' }))
    expect(await guardarComResposta('/api/x', {})).toBeNull()
    expect(toasts[0].texto).toContain('não cabem')
  })
})

/**
 * Sétima pergunta da série: **quantas escritas deitam a resposta fora?**
 *
 * Eram vinte e duas. Faziam `await fetch(...)` e seguiam caminho: mudavam o
 * ecrã, mostravam "Guardado" e navegavam para outra página. Uma recusa do
 * servidor era indistinguível de um sucesso, e o anfitrião só percebia mais
 * tarde — ao reparar que a alteração não estava lá, sem já ligar as duas
 * coisas. As de `/precos` tinham `try/catch`, o que dava a sensação de estarem
 * tratadas: apanha falhas de rede, não apanha um 403.
 */
describe('escritas do cliente', () => {
  const EXCECOES: Record<string, string> = {
    'src/components/push-toggle.tsx':
      'quem manda nas notificações é o browser: o unsubscribe local já as pára, e a linha que sobra no servidor morre no primeiro envio',
  }

  function ficheirosCliente(dir: string): string[] {
    return readdirSync(dir).flatMap(nome => {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) return ficheirosCliente(caminho)
      if (!/\.tsx?$/.test(nome) || nome.includes('.test.')) return []
      return readFileSync(caminho, 'utf-8').startsWith("'use client'") ? [caminho] : []
    })
  }

  it('todas olham para o que o servidor respondeu', () => {
    const raiz = process.cwd()
    const infratores: string[] = []

    for (const caminho of ficheirosCliente(join(raiz, 'src'))) {
      const relativo = caminho.slice(raiz.length + 1)
      if (EXCECOES[relativo]) continue

      const codigo = readFileSync(caminho, 'utf-8')
      const re = /(?:const\s+(\w+)\s*=\s*)?await fetch\(([\s\S]{0,400}?)\)\n/g
      let m: RegExpExecArray | null
      while ((m = re.exec(codigo)) !== null) {
        if (!/method:\s*'(POST|PUT|PATCH|DELETE)'/.test(m[0])) continue
        const variavel = m[1]
        const depois = codigo.slice(m.index + m[0].length, m.index + m[0].length + 400)
        const olha = variavel && new RegExp(`${variavel}\\.(ok|status|json)`).test(depois)
        if (!olha) infratores.push(`${relativo}:${codigo.slice(0, m.index).split('\n').length}`)
      }
    }

    expect(infratores).toEqual([])
  })
})
