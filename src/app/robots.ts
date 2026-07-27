import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/config'
import { adminGetEnabledSiteSlugs } from '@/lib/db-admin'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const slugs = await adminGetEnabledSiteSlugs()

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/r/', '/book/'],
        disallow: [
          '/hoje',
          '/reservas',
          '/hospedes',
          '/propriedades',
          '/calendario',
          '/precos',
          '/relatorios',
          '/concierge',
          '/documentos',
          '/website',
          '/conta',
          '/admin',
          '/api/',
          '/checkin/',
        ],
      },
    ],
    // Sitemap raiz + um por tenant (site público de cada anfitrião — ver
    // docs/SAAS_ARCHITECTURE.md §6.3). Só assim o Google descobre os
    // sitemaps por tenant sem submissão manual em Search Console.
    sitemap: [`${APP_URL}/sitemap.xml`, ...slugs.map(slug => `${APP_URL}/r/${slug}/sitemap.xml`)],
  }
}
