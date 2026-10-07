import {
  PAGINAS_FIXAS, SLUGS_RESERVADOS, slugDePagina,
  type PaginaFixa, type SecaoInicio, type SiteSecoes,
} from './site-mapa'

/**
 * O que está selecionado no editor do mapa do site. Cada nó corresponde a um
 * sítio concreto do site público — a pré-visualização vai lá ter, e clicar lá
 * no site seleciona o nó. É essa ida e volta que torna o mapa «o site», e não
 * um formulário sobre o site.
 */
export type NoDoMapa =
  | { tipo: 'pagina'; id: 'inicio' | PaginaFixa | 'legais' | `p:${string}` }
  | { tipo: 'secao'; id: 'hero' | SecaoInicio }
  | { tipo: 'global'; id: 'menu' | 'rodape' }
  | { tipo: 'alojamento'; id: string }

export function mesmoNo(a: NoDoMapa | null, b: NoDoMapa | null): boolean {
  return Boolean(a && b && a.tipo === b.tipo && a.id === b.id)
}

/**
 * Caminho do nó, relativo à raiz do site do anfitrião. `null` = o nó não muda
 * de página (menu e rodapé estão em todas). Os alojamentos vivem fora do site
 * (`/book/:id`), por isso o caminho é absoluto e começa por `/book/`.
 */
export function caminhoDoNo(no: NoDoMapa): string | null {
  switch (no.tipo) {
    case 'secao': return ''
    case 'global': return null
    case 'alojamento': return `/book/${no.id}`
    case 'pagina':
      if (no.id === 'inicio') return ''
      if (no.id === 'legais') return '/privacidade'
      if (no.id.startsWith('p:')) return `/p/${no.id.slice(2)}`
      return `/${no.id}`
  }
}

/** URL da pré-visualização para um caminho do site. */
export function urlDaPrevisualizacao(origem: string, slug: string, caminho: string): string {
  if (caminho.startsWith('/book/')) return `${origem}${caminho}`
  return `${origem}/r/${slug}${caminho}?editar=1`
}

/** A página onde o hóspede está, a partir do endereço da pré-visualização. */
export function noDoCaminho(pathname: string, slug: string): NoDoMapa | null {
  const book = pathname.match(/^\/book\/([^/?#]+)/)
  if (book) return { tipo: 'alojamento', id: decodeURIComponent(book[1]) }

  const prefixo = `/r/${slug}`
  if (pathname !== prefixo && !pathname.startsWith(`${prefixo}/`)) return null
  const resto = pathname.slice(prefixo.length).replace(/\/+$/, '')
  if (resto === '') return { tipo: 'pagina', id: 'inicio' }

  const [, primeiro, segundo] = resto.split('/')
  if ((PAGINAS_FIXAS as readonly string[]).includes(primeiro)) return { tipo: 'pagina', id: primeiro as PaginaFixa }
  if (primeiro === 'p' && segundo) return { tipo: 'pagina', id: `p:${decodeURIComponent(segundo)}` }
  if (['privacidade', 'cookies', 'termos'].includes(primeiro)) return { tipo: 'pagina', id: 'legais' }
  return null
}

/** A página em que um nó vive — para saber se a pré-visualização tem de mudar. */
export function paginaDoNo(no: NoDoMapa): NoDoMapa {
  if (no.tipo === 'secao') return { tipo: 'pagina', id: 'inicio' }
  return no
}

export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return [...lista]
  const copia = [...lista]
  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item)
  return copia
}

/** Slug livre para uma página nova, com as mesmas regras que o servidor aplica. */
export function slugLivre(secoes: SiteSecoes, titulo: string): string {
  const usados = new Set((secoes.paginas_proprias ?? []).map(p => p.slug))
  let slug = slugDePagina(titulo) || 'pagina'
  if (SLUGS_RESERVADOS.has(slug)) slug = `${slug}-1`
  const base = slug
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`
  return slug
}

export const NOME_SECAO: Record<'hero' | SecaoInicio, string> = {
  hero: 'Topo (título e foto)',
  alojamentos: 'Alojamentos',
  fotos: 'Fotografias',
  porque: 'Porquê reservar direto',
  opinioes: 'Opiniões de hóspedes',
  zona: 'A zona',
  faq: 'Perguntas frequentes',
  anfitriao: 'O anfitrião',
}
