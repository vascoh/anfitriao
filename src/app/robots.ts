import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt'

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
