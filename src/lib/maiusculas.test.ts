import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda das maiúsculas.
 *
 * `capitalize` põe maiúscula em cada palavra: «Terça-Feira, 17 De Novembro»,
 * «Trial Gratuito». Em português os dias e os meses escrevem-se em minúscula;
 * quando um rótulo começa por um, só a primeira letra sobe. Usa-se
 * `first-letter:uppercase` (com `inline-block` se o elemento for inline).
 */
function ficheirosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return ficheirosDe(caminho)
    return e.name.endsWith('.tsx') ? [caminho] : []
  })
}

describe('maiúsculas', () => {
  it('não usa a classe capitalize', () => {
    const achados = ['src/app', 'src/components']
      .flatMap(ficheirosDe)
      .filter((f) => /className=[^>]*\bcapitalize\b/.test(readFileSync(f, 'utf8')))
    expect(achados).toEqual([])
  })
})
