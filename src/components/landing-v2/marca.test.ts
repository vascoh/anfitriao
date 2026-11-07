import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda da marca na landing e nas páginas legais (TODO 2.3).
 *
 * A landing teve paleta própria (slate escuro, ciano, esmeralda, Inter) e
 * contradizia a app e o PRODUCT.md. Agora usa só os tokens de `globals.css`,
 * que já passaram a auditoria de contraste na app, em claro e em escuro.
 *
 * Este teste impede que voltem: paletas Tailwind de acento, `text-white` e
 * hexadecimais soltos. As cores de estado (âmbar/esmeralda com variante
 * `dark:`) são permitidas, porque assinalam estado e não são acento.
 * Também impede o regresso de animação em JS: o `motion` com `whileInView`
 * servia o conteúdo com `opacity:0` até o JavaScript arrancar.
 *
 * Não substitui o axe-core sobre as páginas servidas antes de um deploy
 * com mudanças visuais.
 */

const PROIBIDO: Array<[string, RegExp]> = [
  ['paleta de acento solta', /\b(?:bg|text|border|ring|from|via|to|shadow|outline|fill|stroke|accent)-(?:slate|gray|zinc|neutral|cyan|sky|blue|indigo|violet|purple|teal)-\d{2,3}\b/],
  ['text-white / bg-white', /\b(?:text|bg|border)-white\b/],
  ['hexadecimal solto', /#[0-9a-fA-F]{6}\b/],
  ['animação em JS (motion)', /from ['"]motion\/react['"]/],
  ['scroll suave em JS (lenis)', /from ['"]lenis['"]/],
]

function ficheirosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) return ficheirosDe(caminho)
    if (!/\.tsx?$/.test(entrada.name)) return []
    if (entrada.name.endsWith('.test.ts')) return []
    return [caminho]
  })
}

const ALVOS = ['src/components/landing-v2', 'src/app/(legal)']

describe('marca da landing', () => {
  const ficheiros = [...ALVOS.flatMap(ficheirosDe), 'src/app/page.tsx']

  it('encontra os ficheiros a verificar', () => {
    expect(ficheiros.length).toBeGreaterThan(10)
  })

  it.each(PROIBIDO)('não usa %s', (_nome, padrao) => {
    const infratores = ficheiros.filter((f) => padrao.test(readFileSync(f, 'utf8')))
    expect(infratores).toEqual([])
  })
})
