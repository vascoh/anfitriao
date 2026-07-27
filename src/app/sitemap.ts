import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/config'
import { CONCORRENTES } from '@/lib/comparacoes'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    // Páginas de comparação — conteúdo estável, revisto quando os preços da
    // concorrência forem reverificados (ver PRECOS_VERIFICADOS_EM).
    ...CONCORRENTES.map(c => ({
      url: `${APP_URL}/vs/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
