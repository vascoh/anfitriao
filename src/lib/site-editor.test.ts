import { describe, it, expect } from 'vitest'
import { caminhoDoNo, mover, noDoCaminho, paginaDoNo, slugLivre, urlDaPrevisualizacao } from './site-editor'

describe('editor do site — ida e volta entre o mapa e o site', () => {
  const slug = 'casadomar'

  it('cada página do mapa tem o seu caminho, e o caminho volta ao mesmo nó', () => {
    for (const id of ['inicio', 'sobre', 'galeria', 'localizacao', 'blog', 'p:regras'] as const) {
      const caminho = caminhoDoNo({ tipo: 'pagina', id })
      expect(caminho).not.toBeNull()
      expect(noDoCaminho(`/r/${slug}${caminho}`, slug)).toEqual({ tipo: 'pagina', id })
    }
  })

  it('artigos do blog e páginas legais pertencem ao nó certo', () => {
    expect(noDoCaminho(`/r/${slug}/blog/primeiro-artigo`, slug)).toEqual({ tipo: 'pagina', id: 'blog' })
    expect(noDoCaminho(`/r/${slug}/cookies`, slug)).toEqual({ tipo: 'pagina', id: 'legais' })
  })

  it('as páginas de reserva vivem fora do site, em /book', () => {
    expect(caminhoDoNo({ tipo: 'alojamento', id: 'abc' })).toBe('/book/abc')
    expect(noDoCaminho('/book/abc', slug)).toEqual({ tipo: 'alojamento', id: 'abc' })
    expect(urlDaPrevisualizacao('https://anfitrioes.pt', slug, '/book/abc')).toBe('https://anfitrioes.pt/book/abc')
  })

  it('o site leva o modo de editor no endereço', () => {
    expect(urlDaPrevisualizacao('https://anfitrioes.pt', slug, '/sobre')).toBe('https://anfitrioes.pt/r/casadomar/sobre?editar=1')
  })

  it('o site de outra conta não é deste mapa', () => {
    expect(noDoCaminho('/r/outro/sobre', slug)).toBeNull()
    expect(noDoCaminho('/r/casadomar-2', slug)).toBeNull()
  })

  it('menu e rodapé não mudam de página; secções vivem na inicial', () => {
    expect(caminhoDoNo({ tipo: 'global', id: 'menu' })).toBeNull()
    expect(paginaDoNo({ tipo: 'secao', id: 'faq' })).toEqual({ tipo: 'pagina', id: 'inicio' })
  })
})

describe('editor do site — utilitários', () => {
  it('mover', () => {
    expect(mover(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(mover(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(mover(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })

  it('slugLivre não repete nem tapa rotas', () => {
    const secoes = { paginas_proprias: [{ slug: 'pagina-nova', titulo: 'x', texto: '', visivel: true }] }
    expect(slugLivre(secoes, 'Página nova')).toBe('pagina-nova-2')
    expect(slugLivre({}, 'Blog')).toBe('blog-1')
  })
})
