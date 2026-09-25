import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { APP_URL } from '@/lib/config'
import { resolveLang, t, htmlLang } from '@/lib/i18n'
import { PrivacidadeTexto } from '../_components/legal-texts'
import { SiteNav, SiteFooter } from '../_components/site-chrome'
import { LegalPage } from '../_components/legal-page'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  const lang = resolveLang(settings?.idioma)
  return {
    title: { absolute: settings ? `${lang === 'en' ? 'Privacy Policy' : 'Política de Privacidade'} — ${settings.nome}` : 'Política de Privacidade' },
    alternates: { canonical: `${APP_URL}/r/${slug}/privacidade` },
    robots: { index: false, follow: false },
  }
}

export default async function PrivacidadePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const lang = resolveLang(settings.idioma)
  const contacto = settings.email || settings.telefone || null

  return (
    <div lang={htmlLang(lang)} className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="" />
      <LegalPage title={t(lang, 'legal_privacy_title')} lang={lang}>
        <PrivacidadeTexto lang={lang} nome={settings.nome} contacto={contacto} />
      </LegalPage>
      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
