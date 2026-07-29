import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda de contraste para a landing escura.
 *
 * Contexto: a landing v2 foi auditada com o axe-core (WCAG 2.1 AA) e passou a
 * zero violações, mas antes disso tinha 14 — todas de `text-slate-500` sobre
 * fundos `slate-900`/`slate-950`, que dá 3.7–4.2:1 quando o mínimo é 4.5:1.
 *
 * O que este teste faz: impede que essas classes voltem a entrar nos
 * componentes da landing e das páginas legais.
 *
 * O que este teste **não** faz: não substitui uma auditoria a sério. Não sabe
 * calcular contraste, não vê cores em CSS arbitrário (`text-[#...]`), nem
 * avalia o que é composto em runtime. Antes de um deploy com mudanças visuais,
 * correr o axe-core sobre as páginas servidas.
 */

// Sobre slate-900 (#0f172b) e slate-950 (#020618), nenhuma destas chega a 4.5:1.
const CLASSES_PROIBIDAS = [
  'text-slate-500',
  'text-slate-600',
  'text-slate-700',
  'text-slate-800',
  'placeholder:text-slate-500',
  'placeholder:text-slate-600',
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

const ALVOS = [
  'src/components/landing-v2',
  'src/app/(legal)',
]

describe('contraste da landing escura', () => {
  const ficheiros = ALVOS.flatMap(ficheirosDe)

  it('encontra os ficheiros a verificar', () => {
    expect(ficheiros.length).toBeGreaterThan(10)
  })

  it.each(CLASSES_PROIBIDAS)(
    'não usa %s (não chega a 4.5:1 sobre slate-900/950)',
    (classe) => {
      const infratores = ficheiros.filter((f) => {
        const conteudo = readFileSync(f, 'utf8')
        // fronteira à direita evita que text-slate-50 apanhe text-slate-500
        return new RegExp(`\\b${classe.replace(':', ':')}\\b(?!\\d)`).test(conteudo)
      })
      expect(infratores).toEqual([])
    },
  )
})
