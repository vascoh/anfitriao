import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

/**
 * **Quem fala com o mundo lá fora declara quanto tempo pode demorar.**
 *
 * A verificação de disponibilidade ao vivo (`lib/disponibilidade-ao-vivo.ts`)
 * lê os calendários das plataformas antes de aceitar uma reserva. É uma ida à
 * rede dentro de rotas que antes só falavam com a base — e uma rota sem teto
 * declarado fica com o que a plataforma de alojamento der por omissão.
 *
 * Aconteceu: quando `hasConflict` passou a consultar os feeds, o webhook do
 * Stripe herdou essa chamada sem que ninguém lhe subisse o teto. Um webhook
 * que expira, nesse caminho, é dinheiro cobrado e calendário vazio.
 *
 * Este teste segue os `import` a partir de cada rota e exige `maxDuration` em
 * todas as que **transitivamente** chegam à verificação ao vivo. É calculado,
 * não é uma lista escrita à mão: uma cadeia de imports nova entra sozinha.
 */

const SRC = join(process.cwd(), 'src')
const API = join(SRC, 'app/api')

/** O módulo cuja presença na cadeia obriga a declarar um teto. */
const ALVO = 'lib/disponibilidade-ao-vivo'

function ficheirosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ficheirosDeRota(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

/** Resolve um especificador de import para um ficheiro real, ou null. */
function resolver(especificador: string, apartirDe: string): string | null {
  const base = especificador.startsWith('@/')
    ? join(SRC, especificador.slice(2))
    : especificador.startsWith('.')
      ? resolve(dirname(apartirDe), especificador)
      : null // pacote externo

  if (!base) return null
  for (const tentativa of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(tentativa) && statSync(tentativa).isFile()) return tentativa
  }
  return null
}

/** Chega-se ao alvo a partir deste ficheiro, seguindo imports? */
function alcancaOAlvo(ficheiro: string, vistos = new Set<string>()): boolean {
  if (vistos.has(ficheiro)) return false
  vistos.add(ficheiro)

  const codigo = readFileSync(ficheiro, 'utf-8')
  if (ficheiro.includes(ALVO)) return true

  const especificadores = [...codigo.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
  for (const esp of especificadores) {
    if (esp.includes(ALVO)) return true
    const destino = resolver(esp, ficheiro)
    if (destino && alcancaOAlvo(destino, vistos)) return true
  }
  return false
}

describe('rotas que consultam as plataformas ao vivo', () => {
  it('todas declaram um teto de execução', () => {
    const semTeto = ficheirosDeRota(API)
      .filter(f => alcancaOAlvo(f))
      .filter(f => !/export const maxDuration/.test(readFileSync(f, 'utf-8')))
      .map(f => f.slice(API.length + 1))

    expect(semTeto).toEqual([])
  })

  it('o teste sabe encontrar as rotas em causa — senão não prova nada', () => {
    /* Uma guarda que não encontra nada passa sempre. Se a verificação ao vivo
     * mudar de sítio, isto falha e obriga a atualizar o alvo. */
    const alcancam = ficheirosDeRota(API).filter(f => alcancaOAlvo(f))
    expect(alcancam.length).toBeGreaterThanOrEqual(4)
  })
})
