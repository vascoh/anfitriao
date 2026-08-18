import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { estadoSiba } from './estado-siba'

/**
 * Guarda estrutural nascida da quarta pergunta: **que estados existem no
 * modelo e não são tratados na interface?**
 *
 * A resposta foi um caminho inteiro invisível. As quatro colunas de prova da
 * comunicação do boletim eram escritas e não apareciam em ecrã nenhum; e o
 * estado tinha um quarto valor, `a_processar`, que nunca chegou a ser escrito
 * por código nenhum — um estado declarado sem produtor, que qualquer mapa de
 * rótulos mostraria como etiqueta vazia.
 *
 * O que se verifica aqui é a ligação entre as duas pontas: **tudo o que o
 * código escreve tem de ter tradução**, e a tradução não pode inventar
 * estados que ninguém produz. É a regra que faltava quando se acrescentou a
 * submissão sem acrescentar onde a ver.
 */

const SRC = join(process.cwd(), 'src')

function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ficheiros(caminho)
    return /\.tsx?$/.test(nome) && !nome.includes('.test.') ? [caminho] : []
  })
}

/** Valores literais atribuídos a uma coluna em todo o código de produção. */
function valoresEscritos(coluna: string): string[] {
  const re = new RegExp(`${coluna}:\\s*'([a-z_]+)'`, 'g')
  const encontrados = new Set<string>()
  for (const caminho of ficheiros(SRC)) {
    const codigo = readFileSync(caminho, 'utf-8')
    let m: RegExpExecArray | null
    while ((m = re.exec(codigo)) !== null) encontrados.add(m[1])
  }
  return [...encontrados]
}

describe('estados do boletim escritos e mostrados', () => {
  it('todo o valor que o código grava tem tradução própria', () => {
    const escritos = valoresEscritos('siba_status')
    expect(escritos.length).toBeGreaterThan(0)

    // Cada estado escrito tem de dar um resumo diferente dos outros: se dois
    // caírem no mesmo ramo, um deles não está a ser tratado.
    const chaves = escritos.map(v => estadoSiba({ siba_status: v }).chave)
    expect(new Set(chaves).size).toBe(escritos.length)
  })

  it('cada estado diz se ainda há obrigação por cumprir', () => {
    for (const v of valoresEscritos('siba_status')) {
      const r = estadoSiba({ siba_status: v })
      expect(r.texto, `${v} sem rótulo`).toBeTruthy()
      expect(typeof r.porCumprir).toBe('boolean')
    }
  })

  it('o tipo não declara estados que ninguém escreve', () => {
    /* `a_processar` viveu assim desde o início: no tipo, em nenhum `update`.
     * Um estado sem produtor é uma promessa de comportamento que não existe —
     * e obriga toda a interface a tratar um caso impossível. */
    const tipos = readFileSync(join(SRC, 'lib/types.ts'), 'utf-8')
    const declarado = tipos.match(/siba_status\?:\s*([^\n]+)/)?.[1] ?? ''
    const valoresDoTipo = [...declarado.matchAll(/'([a-z_]+)'/g)].map(m => m[1])

    const escritos = new Set([...valoresEscritos('siba_status'), 'nao_submetido']) // o de omissão vem da base
    const semProdutor = valoresDoTipo.filter(v => !escritos.has(v))

    expect(semProdutor).toEqual([])
  })
})
