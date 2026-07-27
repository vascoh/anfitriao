import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug, adminGetPublishedPostBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { resolveLang, t } from '@/lib/i18n'
import { APP_URL } from '@/lib/config'
import { SiteNav, SiteFooter } from '../../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; postSlug: string }> }
): Promise<Metadata> {
  const { slug, postSlug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  const post = settings?.owner_id ? await adminGetPublishedPostBySlug(settings.owner_id, postSlug) : null
  if (!post) return { title: 'Blog', robots: { index: false, follow: false } }

  const title = `${post.titulo} — ${settings?.nome}`
  return {
    title,
    description: post.resumo ?? undefined,
    alternates: { canonical: `${APP_URL}/r/${slug}/blog/${postSlug}` },
    robots: { index: false, follow: false },
    openGraph: post.imagem_capa
      ? { type: 'article', title, description: post.resumo ?? undefined, images: [{ url: post.imagem_capa }] }
      : undefined,
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const post = settings.owner_id ? await adminGetPublishedPostBySlug(settings.owner_id, postSlug) : null
  if (!post) notFound()

  const theme = siteTheme(settings)
  const lang = resolveLang(settings.idioma)
  const paragraphs = post.conteudo.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/blog" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-6">
        <Link href={`/r/${slug}/blog`} className="text-xs font-semibold text-primary hover:underline">
          {t(lang, 'blog_back')}
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{post.titulo}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(post.criado_em))}
          </p>
        </div>

        {post.imagem_capa && (
          <div className="relative h-64 w-full rounded-xl overflow-hidden bg-muted">
            <Image src={post.imagem_capa} alt={post.titulo} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
