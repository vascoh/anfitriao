import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Preços no formato português: «80 €», não «€80».
 *
 * A landing passou ao formato pt-PT a 2026-11-07, mas a app ainda escrevia
 * `€{valor}` à mão em nove sítios (nova reserva, preços, alojamentos): no
 * mesmo ecrã aparecia «0 €» ao lado de «€0». O `fmtMoney` de `lib/utils`
 * formata com o `Intl` em pt-PT e trata dos cêntimos.
 */
function ficheirosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return ficheirosDe(caminho)
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [caminho] : []
  })
}

describe('formato dos preços', () => {
  it('não escreve o símbolo do euro antes do valor', () => {
    const infratores = ['src/app', 'src/components'].flatMap(ficheirosDe).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((linha, i) => (/€\{/.test(linha) ? `${f}:${i + 1}: ${linha.trim().slice(0, 100)}` : null))
        .filter((x): x is string => x !== null),
    )
    expect(infratores).toEqual([])
  })
})
