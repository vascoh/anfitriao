import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { APP_URL } from '@/lib/config'
import { SiteNav, SiteFooter } from '../_components/site-chrome'
import { LegalPage } from '../_components/legal-page'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return {
    title: settings ? `Política de Cookies — ${settings.nome}` : 'Cookies',
    alternates: { canonical: `${APP_URL}/r/${slug}/cookies` },
    robots: { index: false, follow: false },
  }
}

export default async function CookiesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="" />
      <LegalPage title="Política de Cookies">
        <p>Este site usa apenas cookies técnicos essenciais ao funcionamento do processo de reserva (ex.: manter os dados do formulário durante a navegação). Não usamos cookies de publicidade ou de rastreio de terceiros.</p>
        <h2>O que são cookies</h2>
        <p>Pequenos ficheiros guardados no teu dispositivo que permitem ao site funcionar corretamente durante a tua visita.</p>
        <h2>Como gerir</h2>
        <p>Podes limpar ou bloquear cookies nas definições do teu browser a qualquer momento, sem afetar a tua capacidade de contactar {settings.nome} diretamente.</p>
      </LegalPage>
      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
