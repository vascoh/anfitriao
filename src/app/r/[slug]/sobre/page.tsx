import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { acessoAoSite } from '@/lib/site-acesso'
import { paginaFixaVisivel, paragrafos } from '@/lib/site-mapa'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { baseUrlDoSite } from '@/lib/site-request'
import { resolveLang, t, htmlLang, hostFallbackBio } from '@/lib/i18n'
import { SiteNav, SiteFooter, WA_SVG } from '../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  const siteUrl = await baseUrlDoSite(slug)
  const lang = resolveLang(settings?.idioma)
  return {
    title: { absolute: settings ? `${lang === 'en' ? 'About' : 'Sobre'} — ${settings.nome}` : 'Sobre' },
    alternates: { canonical: `${siteUrl}/sobre` },
    robots: { index: false, follow: false },
  }
}

export default async function SobrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings) notFound()
  const paginaVisivel = paginaFixaVisivel(settings.secoes, 'sobre')
  if (!(await acessoAoSite(settings, paginaVisivel)).pode) notFound()

  const theme = siteTheme(settings)
  const lang = resolveLang(settings.idioma)
  const waLink = settings.telefone ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}` : null

  return (
    <div lang={htmlLang(lang)} className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/sobre" paginaOculta={!paginaVisivel} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col items-center text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">
            {(settings.host_nome ?? settings.nome).slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 data-campo="host_nome" className="font-bold text-2xl">{settings.host_nome || settings.nome}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t(lang, 'host_role')}</p>
        </div>
        {settings.host_bio ? (
          <p data-campo="host_bio" className="text-base text-muted-foreground leading-relaxed max-w-lg">{settings.host_bio}</p>
        ) : (
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
            {settings.descricao || hostFallbackBio(lang, settings.nome)}
          </p>
        )}
        {paragrafos(settings.secoes?.sobre_texto).length > 0 && (
          <div data-campo-paragrafos="sobre_texto" className="flex flex-col gap-4 text-left text-sm text-foreground/80 leading-relaxed max-w-lg">
            {paragrafos(settings.secoes?.sobre_texto).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
        )}
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#075E54] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            {WA_SVG}
            {t(lang, 'talk_to_host')}
          </a>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
