import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/config'


export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
