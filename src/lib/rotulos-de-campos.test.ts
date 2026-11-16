import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

/**
 * Guarda dos rótulos de formulário.
 *
 * O padrão `<div><label>Data</label><input/></div>` parece certo no ecrã, mas
 * o `<label>` sem `htmlFor` não fica ligado ao campo: o leitor de ecrã anuncia
 * «campo de data» sem dizer qual, e tocar no texto não foca o campo. O axe
 * marcou-o como crítico em seis ecrãs em produção (2026-11-16) e havia 112
 * casos. A forma certa é o `<label>` envolver o campo (com o texto num
 * `<span>`) ou ter `htmlFor` com o `id` do campo.
 */
const CONTROLOS = new Set(['input', 'select', 'textarea', 'Input', 'Select', 'Textarea'])

function ficheirosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return ficheirosDe(caminho)
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [caminho] : []
  })
}

function rotulosOrfaos(ficheiro: string): string[] {
  const src = readFileSync(ficheiro, 'utf8')
  if (!src.includes('<label')) return []
  const sf = ts.createSourceFile(ficheiro, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nome = (n: ts.Node) =>
    ts.isJsxElement(n) ? n.openingElement.tagName.getText(sf) : ts.isJsxSelfClosingElement(n) ? n.tagName.getText(sf) : ''
  const atributos = (n: ts.JsxElement | ts.JsxSelfClosingElement) =>
    (ts.isJsxElement(n) ? n.openingElement.attributes : n.attributes).properties.map((p) => p.name?.getText(sf))
  const descendentes = (n: ts.Node, acc: (ts.JsxElement | ts.JsxSelfClosingElement)[] = []) => {
    n.forEachChild((c) => {
      if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) acc.push(c)
      descendentes(c, acc)
    })
    return acc
  }
  const achados: string[] = []
  const visitar = (n: ts.Node) => {
    if (ts.isJsxElement(n) && nome(n) === 'div') {
      const filhos = n.children.filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c))
      const rotulo = filhos[0]
      if (rotulo && ts.isJsxElement(rotulo) && nome(rotulo) === 'label' && !atributos(rotulo).includes('htmlFor')) {
        const controlos = descendentes(n).filter((d) => CONTROLOS.has(nome(d)))
        const nomeado = controlos.some((c) => atributos(c).some((a) => a === 'id' || a === 'aria-label' || a === 'aria-labelledby'))
        const envolve = descendentes(rotulo).some((d) => CONTROLOS.has(nome(d)))
        if (controlos.length === 1 && !nomeado && !envolve) {
          achados.push(`${ficheiro}:${sf.getLineAndCharacterOfPosition(rotulo.getStart(sf)).line + 1}`)
        }
      }
    }
    n.forEachChild(visitar)
  }
  visitar(sf)
  return achados
}

describe('rótulos de campos', () => {
  const ficheiros = ['src/app', 'src/components'].flatMap(ficheirosDe)

  it('encontra os formulários', () => {
    expect(ficheiros.filter((f) => readFileSync(f, 'utf8').includes('<label')).length).toBeGreaterThan(20)
  })

  it('não deixa <label> soltos ao lado de um só campo', () => {
    expect(ficheiros.flatMap(rotulosOrfaos)).toEqual([])
  })
})
