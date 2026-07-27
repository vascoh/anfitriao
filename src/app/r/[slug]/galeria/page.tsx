import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug, adminGetProperties } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { SiteNav, SiteFooter } from '../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return { title: settings ? `Galeria — ${settings.nome}` : 'Galeria', robots: { index: false, follow: false } }
}

export default async function GaleriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const allProps = settings.owner_id ? await adminGetProperties(settings.owner_id) : []
  const photos = allProps
    .filter(p => p.ativo)
    .flatMap(p => {
      const urls = [p.imagem_url, ...(p.fotos ?? [])].filter((u): u is string => !!u)
      return urls.map(url => ({ url, nome: p.nome, id: p.id }))
    })

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/galeria" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Galeria</h1>

        {photos.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">Ainda não há fotografias disponíveis.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo, i) => (
              <div key={`${photo.id}-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <Image src={photo.url} alt={photo.nome} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
                  <p className="text-white text-xs font-semibold truncate">{photo.nome}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
