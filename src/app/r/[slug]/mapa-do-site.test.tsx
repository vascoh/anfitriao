import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SiteSecoes } from '@/lib/site-mapa'

/**
 * O site público segue o mapa que o anfitrião montou no editor: a ordem das
 * secções, o que está escondido e as páginas próprias. E o que está escondido
 * só o dono vê — é o que deixa montar o site antes de o mostrar.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
vi.mock('./_components/site-chrome', () => ({ SiteNav: () => null, SiteFooter: () => null, WA_SVG: null }))
vi.mock('@/lib/site-theme', () => ({ siteTheme: () => ({ className: '', style: {} }) }))
vi.mock('@/lib/site-request', () => ({
  basePathDoSite: async (slug: string) => `/r/${slug}`,
  baseUrlDoSite: async (slug: string) => `https://anfitrioes.pt/r/${slug}`,
}))

let dono = false
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: dono ? 'o1' : null }) }))

let secoes: SiteSecoes = {}
let enabled = true
vi.mock('@/lib/db-admin', async () => {
  const { normalizarSecoes } = await import('@/lib/site-mapa')
  return {
    adminGetWebsiteSettingsBySlug: async () => ({
      enabled, nome: 'Casa Azul', idioma: 'pt', owner_id: 'o1', telefone: '', email: 'ola@casaazul.pt',
      min_noites: 1, host_nome: 'Rita', host_bio: 'Recebo desde 2016.', descricao: 'Perto da praia.',
      secoes: normalizarSecoes(secoes),
    }),
    adminGetProperties: async () => [
      { id: 'p1', nome: 'T1 Mar', ativo: true, parent_id: null, cidade: 'Ericeira', tipo: 'apartamento', preco_base: 90,
        quartos: 1, casasBanho: 1, capacidade: 2, comodidades: [], cor: '#000000', imagem_url: null, fotos: [] },
    ],
  }
})

async function render(modulo: string, params: Record<string, string>, searchParams: Record<string, string> = {}) {
  const { default: Pagina } = await import(modulo)
  return renderToStaticMarkup(await Pagina({ params: Promise.resolve({ slug: 'casa-azul', ...params }), searchParams: Promise.resolve(searchParams) }))
}

/** Ids das secções da inicial, pela ordem em que aparecem no HTML. */
function ordem(html: string): string[] {
  return [...html.matchAll(/data-secao="([a-z]+)"( hidden="")?/g)]
    .filter(m => m[1] !== 'hero')
    .map(m => (m[2] ? `${m[1]}(oculta)` : m[1]))
}

beforeEach(() => { secoes = {}; enabled = true; dono = false })

describe('página inicial segue o mapa', () => {
  it('sem mapa, as secções de sempre — sem FAQ vazio nem fotografias', async () => {
    expect(ordem(await render('./page', {}))).toEqual(['alojamentos', 'porque', 'anfitriao'])
  })

  it('pela ordem do anfitrião, sem as escondidas', async () => {
    secoes = { inicio: [{ id: 'anfitriao', visivel: true }, { id: 'porque', visivel: false }], faq: [{ pergunta: 'Animais?', resposta: 'Sim.' }] }
    expect(ordem(await render('./page', {}))).toEqual(['anfitriao', 'alojamentos', 'faq'])
  })

  it('em modo de editor, o dono vê também as escondidas — marcadas', async () => {
    dono = true
    secoes = { inicio: [{ id: 'porque', visivel: false }] }
    const html = await render('./page', {}, { editar: '1' })
    expect(ordem(html)).toContain('porque(oculta)')
    // As fotografias nascem escondidas; o FAQ vazio aparece como espaço por preencher.
    expect(ordem(html)).toEqual(['porque(oculta)', 'alojamentos', 'fotos(oculta)', 'faq', 'anfitriao'])
    expect(html).toContain('Secção vazia')
  })

  it('o modo de editor não serve a quem não é o dono', async () => {
    secoes = { inicio: [{ id: 'porque', visivel: false }] }
    const html = await render('./page', {}, { editar: '1' })
    expect(html).not.toContain('Sem taxas de serviço')
  })

  it('textos próprios de «porquê reservar direto»', async () => {
    secoes = { porque: [{ titulo: '', texto: '' }, { titulo: '', texto: '' }, { titulo: 'Cancelamento até 7 dias', texto: '' }] }
    const html = await render('./page', {})
    expect(html).toContain('Cancelamento até 7 dias')
    expect(html).not.toContain('Cancelamento flexível')
  })

  it('site desligado: em manutenção para hóspedes, o site inteiro para o dono', async () => {
    enabled = false
    expect(await render('./page', {})).toContain('Website em manutenção')
    dono = true
    expect(await render('./page', {})).toContain('T1 Mar')
  })
})

describe('páginas escondidas e páginas próprias', () => {
  it('uma página escondida dá 404 ao hóspede e abre ao dono', async () => {
    secoes = { paginas: { sobre: { visivel: false } } }
    await expect(render('./sobre/page', {})).rejects.toThrow('404')
    dono = true
    expect(await render('./sobre/page', {})).toContain('Rita')
  })

  it('a página Sobre mostra a história em parágrafos', async () => {
    secoes = { sobre_texto: 'Comecei em 2016.\n\nHoje são duas casas.' }
    const html = await render('./sobre/page', {})
    expect(html).toContain('<p class="whitespace-pre-line">Comecei em 2016.</p>')
    expect(html).toContain('<p class="whitespace-pre-line">Hoje são duas casas.</p>')
  })

  it('página própria: visível para todos, escondida só para o dono, inexistente para ninguém', async () => {
    secoes = { paginas_proprias: [{ slug: 'regras', titulo: 'Regras da casa', texto: 'Sem festas.', visivel: true }] }
    const html = await render('./p/[pagina]/page', { pagina: 'regras' })
    expect(html).toContain('Regras da casa')
    expect(html).toContain('Sem festas.')
    expect(html).toContain('lang="pt-PT"')

    await expect(render('./p/[pagina]/page', { pagina: 'nao-existe' })).rejects.toThrow('404')

    secoes = { paginas_proprias: [{ slug: 'regras', titulo: 'Regras da casa', texto: 'Sem festas.', visivel: false }] }
    await expect(render('./p/[pagina]/page', { pagina: 'regras' })).rejects.toThrow('404')
    dono = true
    expect(await render('./p/[pagina]/page', { pagina: 'regras' })).toContain('Sem festas.')
  })
})
