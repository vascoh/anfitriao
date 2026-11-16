import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda das cores de estado na app (horizonte 2, ponto 3 do plano).
 *
 * Cinquenta ecrãs escreviam o verde, o âmbar e o vermelho à mão
 * (`text-emerald-700`, `bg-amber-50 dark:bg-amber-950/30`…), e uma parte
 * esquecia a variante escura: texto verde-escuro sobre carvão, abaixo de 2:1.
 * Passaram aos tokens `sucesso`, `aviso`, `erro` e `info` de `globals.css`,
 * que mudam com o tema e já foram medidos para AA.
 *
 * Ficam de fora os sites públicos dos anfitriões (`/r`, editor e
 * pré-visualização): têm temas próprios escolhidos por quem os publica.
 */
const PALETA_DE_ESTADO =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline)-(?:[trblxyse]-)?(?:emerald|green|amber|yellow|orange|lime|teal|cyan|red|rose|pink|fuchsia|purple|violet|indigo|blue|sky)-\d{2,3}\b/

const EXCLUIDOS = [/src\/app\/r\//, /src\/components\/site-editor\//, /website-preview\.tsx$/]

function ficheirosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return ficheirosDe(caminho)
    if (!e.name.endsWith('.tsx') || e.name.includes('.test.')) return []
    return [caminho]
  })
}

describe('cores de estado', () => {
  const ficheiros = ['src/app', 'src/components']
    .flatMap(ficheirosDe)
    .filter((f) => !EXCLUIDOS.some((r) => r.test(f.replaceAll('\\', '/'))))

  it('encontra os ecrãs da app', () => {
    expect(ficheiros.length).toBeGreaterThan(50)
  })

  it('usa os tokens semânticos em vez de paletas soltas', () => {
    const infratores = ficheiros.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((linha, i) => (PALETA_DE_ESTADO.test(linha) ? `${f}:${i + 1}: ${linha.trim().slice(0, 100)}` : null))
        .filter((x): x is string => x !== null),
    )
    expect(infratores).toEqual([])
  })
})
