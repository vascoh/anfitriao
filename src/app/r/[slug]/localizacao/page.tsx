import { notFound } from 'next/navigation'
import { MapPin, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug, adminGetProperties } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { APP_URL } from '@/lib/config'
import { SiteNav, SiteFooter } from '../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return {
    title: settings ? `Localização — ${settings.nome}` : 'Localização',
    alternates: { canonical: `${APP_URL}/r/${slug}/localizacao` },
    robots: { index: true, follow: true },
  }
}

export default async function LocalizacaoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const allProps = settings.owner_id ? await adminGetProperties(settings.owner_id) : []
  const props = allProps.filter(p => p.ativo && !p.parent_id)

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/localizacao" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Localização</h1>

        {props.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">Sem alojamentos disponíveis neste momento.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {props.map(p => {
              // Morada completa só se o anfitrião optar por mostrá-la; caso
              // contrário mostra-se apenas a cidade/zona (mapa aproximado).
              const showFull = p.mostrar_morada_publica
              const query = encodeURIComponent(showFull ? `${p.endereco}, ${p.cidade}` : p.cidade)
              return (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{p.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {showFull ? `${p.endereco}, ${p.cidade}` : p.cidade}
                    </p>
                    {!showFull && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">A morada exata é partilhada após confirmação da reserva.</p>
                    )}
                  </div>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0 hover:underline">
                    Ver mapa <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
