/**
 * O que um domínio próprio serve. É uma lista do que se pode abrir, não do
 * que se proíbe: uma rota nova da app fica fechada no domínio por omissão,
 * como fica privada em `proxy.ts`.
 */

/** Páginas do site, reescritas para `/r/<slug>/…`. */
const PAGINAS_DO_SITE = new Set(['/', '/sobre', '/galeria', '/localizacao', '/blog', '/privacidade', '/cookies', '/termos', '/sitemap.xml'])
const PREFIXOS_DO_SITE = ['/blog/', '/p/', '/alojamento/']

/**
 * O que as páginas do site chamam com caminhos relativos e que, por isso,
 * chega ao domínio do anfitrião: a confirmação da reserva (`router.push`), o
 * check-in e as APIs públicas do hóspede, imagens de partilha e ícones.
 */
const PASSA = [
  /^\/book\/[^/]+(\/confirmacao)?\/?$/,
  /^\/checkin\/[^/]+\/?$/,
  /^\/api\/book(\/grupo|\/checkout)?$/,
  /^\/api\/book-confirmation\/[^/]+$/,
  /^\/api\/checkin\/[^/]+$/,
  /^\/api\/documentos\/extrair$/,
  /^\/api\/og(\/|$)/,
  /^\/api\/pwa-icon(\/|$)/,
  /^\/manifest\.json$/,
  /^\/icons\//,
]

export type DestinoNoDominio = 'site' | 'passa' | 'robots' | 'nao-existe'

export function destinoNoDominioProprio(path: string): DestinoNoDominio {
  if (PAGINAS_DO_SITE.has(path) || PREFIXOS_DO_SITE.some(p => path.startsWith(p))) return 'site'
  if (path === '/robots.txt') return 'robots'
  if (PASSA.some(re => re.test(path))) return 'passa'
  return 'nao-existe'
}

/** O robots.txt da plataforma lista os sitemaps de todos os anfitriões. */
export function robotsDoDominio(host: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /book/\nDisallow: /checkin/\n\nSitemap: https://${host}/sitemap.xml\n`
}
