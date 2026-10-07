import { NextResponse } from 'next/server'
import { adminGetWebsiteSettingsBySlug, adminGetProperties, adminGetPublishedPosts } from '@/lib/db-admin'
import { APP_URL } from '@/lib/config'
import { baseUrlDoSite } from '@/lib/site-request'
import { entradasDoMenu, normalizarSecoes, paginaFixaVisivel } from '@/lib/site-mapa'

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * GET /r/[slug]/sitemap.xml — sitemap dedicado por tenant, referenciado a
 * partir do sitemap raiz (ver docs/SAAS_ARCHITECTURE.md §6.3). Gerado a
 * pedido (sem cache de build) porque o conteúdo (propriedades, posts) muda
 * fora de deploys.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) {
    return new NextResponse('Not found', { status: 404 })
  }

  const base = await baseUrlDoSite(slug)
  // Só o que está visível no mapa do site: uma página escondida dá 404 a quem não é o dono.
  const secoes = normalizarSecoes(settings.secoes)
  const staticPaths = [
    '',
    ...entradasDoMenu(secoes, 'pt').filter(e => e.visivel).map(e => e.href),
    '/privacidade', '/cookies', '/termos',
  ]

  const [properties, posts] = await Promise.all([
    adminGetProperties(settings.owner_id ?? undefined),
    settings.owner_id ? adminGetPublishedPosts(settings.owner_id) : Promise.resolve([]),
  ])

  const urls = [
    ...staticPaths.map(p => `${base}${p}`),
    ...properties.filter(p => p.ativo).map(p => `${APP_URL}/book/${p.id}`),
    ...(paginaFixaVisivel(secoes, 'blog') ? posts.map(p => `${base}/blog/${p.slug}`) : []),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n')}
</urlset>
`

  return new NextResponse(body, { headers: { 'Content-Type': 'application/xml' } })
}
