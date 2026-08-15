import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug, adminGetPublishedPosts } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { resolveLang, t } from '@/lib/i18n'
import { APP_URL } from '@/lib/config'
import { SiteNav, SiteFooter } from '../_components/site-chrome'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return {
    title: { absolute: settings ? `Blog — ${settings.nome}` : 'Blog' },
    alternates: { canonical: `${APP_URL}/r/${slug}/blog` },
    robots: { index: false, follow: false },
  }
}

export default async function BlogListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const lang = resolveLang(settings.idioma)
  const posts = settings.owner_id ? await adminGetPublishedPosts(settings.owner_id) : []

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="/blog" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Blog</h1>

        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">{t(lang, 'blog_empty')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map(post => (
              <Link key={post.id} href={`/r/${slug}/blog/${post.slug}`}
                className="group flex gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                {post.imagem_capa && (
                  <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                    <Image src={post.imagem_capa} alt={post.titulo} fill sizes="80px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">{post.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {post.resumo || post.conteudo}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                    {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(post.criado_em))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
