import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { acessoAoSite } from '@/lib/site-acesso'
import { normalizarSecoes, paginaPropria, paragrafos } from '@/lib/site-mapa'
import { siteTheme } from '@/lib/site-theme'
import { baseUrlDoSite } from '@/lib/site-request'
import { resolveLang, htmlLang } from '@/lib/i18n'
import { SiteNav, SiteFooter } from '../../_components/site-chrome'

/**
 * Página própria do anfitrião — «Regras da casa», «Como chegar», «Experiências».
 * Texto simples, em parágrafos, como o blog: sem HTML nem markdown, para não
 * haver nada a sanitizar nem um editor de formatação a manter.
 */

type Params = { params: Promise<{ slug: string; pagina: string }> }

async function carregar(slug: string, pagina: string) {
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings) return null
  const propria = paginaPropria(normalizarSecoes(settings.secoes), pagina)
  return propria ? { settings, propria } : null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, pagina } = await params
  const dados = await carregar(slug, pagina)
  const siteUrl = await baseUrlDoSite(slug)
  if (!dados) return { title: 'Página' }
  const primeiro = paragrafos(dados.propria.texto)[0]
  return {
    title: { absolute: `${dados.propria.titulo} — ${dados.settings.nome}` },
    description: primeiro ? primeiro.slice(0, 160) : undefined,
    alternates: { canonical: `${siteUrl}/p/${dados.propria.slug}` },
    robots: { index: false, follow: false },
  }
}

export default async function PaginaPropriaPage({ params }: Params) {
  const { slug, pagina } = await params
  const dados = await carregar(slug, pagina)
  if (!dados) notFound()
  const { settings, propria } = dados
  if (!(await acessoAoSite(settings, propria.visivel)).pode) notFound()

  const theme = siteTheme(settings)
  const lang = resolveLang(settings.idioma)

  return (
    <div lang={htmlLang(lang)} className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active={`/p/${propria.slug}`} paginaOculta={!propria.visivel} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-6">
        <h1 data-campo={`pagina.${propria.slug}.titulo`} className="text-2xl font-bold tracking-tight">{propria.titulo}</h1>
        <div data-campo-paragrafos={`pagina.${propria.slug}.texto`} className="flex flex-col gap-4 text-sm text-foreground/80 leading-relaxed">
          {paragrafos(propria.texto).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
