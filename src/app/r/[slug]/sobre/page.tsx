import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { SiteNav, SiteFooter, WA_SVG } from '../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return { title: settings ? `Sobre — ${settings.nome}` : 'Sobre', robots: { index: false, follow: false } }
}

export default async function SobrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const waLink = settings.telefone ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}` : null

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/sobre" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col items-center text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">
            {(settings.host_nome ?? settings.nome).slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="font-bold text-2xl">{settings.host_nome ?? settings.nome}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Anfitrião</p>
        </div>
        {settings.host_bio ? (
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">{settings.host_bio}</p>
        ) : (
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
            {settings.descricao || `${settings.nome} recebe hóspedes com atenção ao detalhe e disponibilidade para o que precisares.`}
          </p>
        )}
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#075E54] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            {WA_SVG}
            Falar com o anfitrião
          </a>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
