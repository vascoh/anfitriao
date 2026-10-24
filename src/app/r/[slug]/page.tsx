import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { MapPin, ArrowRight } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import { adminGetWebsiteSettingsBySlug, adminGetProperties } from '@/lib/db-admin'
import { APP_URL } from '@/lib/config'
import { baseUrlDoSite, basePathDoSite } from '@/lib/site-request'
import { siteTheme } from '@/lib/site-theme'
import { SiteNav, SiteFooter, WA_SVG } from './_components/site-chrome'
import { resolveLang, t, htmlLang, listingAvailable } from '@/lib/i18n'
import { dadosDoCartao, fotosDe, quartosDe } from '@/lib/site-alojamentos'
import { CartaoAlojamento } from './_components/cartao-alojamento'
import { eDonoDoSite } from '@/lib/site-acesso'
import { secoesDoInicio, itensPorque, paginaFixaVisivel, nomePaginaFixa, paragrafos, type SecaoInicio, type OrigemOpiniao } from '@/lib/site-mapa'
import type { ReactNode } from 'react'

// ─── Metadata (SEO) ───────────────────────────────────────────────────────────


export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  const siteUrl = await baseUrlDoSite(slug)
  if (!settings) return { title: 'Reservas' }

  const title = settings.nome
  const description = settings.descricao || `Reserve diretamente em ${settings.nome}. Sem comissões.`
  const ogImage = `${APP_URL}/api/og?title=${encodeURIComponent(title)}`

  return {
    /* `absolute` porque o layout da raiz tem `template: '%s · Anfitrião'`.
     * Este é o site **do cliente**: o separador do browser não leva o nome da
     * plataforma, tal como um site feito à medida não levaria o da agência. */
    title: { absolute: title },
    description,
    openGraph: {
      type: 'website',
      locale: resolveLang(settings.idioma) === 'en' ? 'en_US' : 'pt_PT',
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: siteUrl },
    robots: { index: false, follow: false },
  }
}

const NOME_ORIGEM: Record<Exclude<OrigemOpiniao, 'direto'>, string> = {
  airbnb: 'Airbnb', booking: 'Booking.com', google: 'Google',
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default async function ReservasPage(
  { params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)

  if (!settings) notFound()

  /* `?editar=1` é o modo do editor do mapa do site: desenha também as secções
   * escondidas (com `hidden`), para o editor as poder mostrar e reordenar ao
   * vivo antes de guardar. Só vale para o dono — para os outros é o site normal. */
  const dono = await eDonoDoSite(settings)
  const modoEditor = (await searchParams).editar === '1' && dono

  if (!settings.enabled && !dono) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Website em manutenção</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          O website de reservas não está disponível neste momento.
        </p>
      </div>
    )
  }

  const allProps = settings.owner_id
    ? await adminGetProperties(settings.owner_id as string)
    : []
  // Quartos (parent_id) não aparecem como alojamentos independentes — reservam-se
  // dentro da página da casa-mãe (evita contagem inflacionada e dupla reserva)
  const props = allProps.filter(p => !p.parent_id && p.ativo)
  const minRoomPrice = new Map<string, number>()
  for (const room of allProps) {
    if (!room.parent_id || !room.ativo) continue
    const cur = minRoomPrice.get(room.parent_id)
    if (cur === undefined || room.preco_base < cur) minRoomPrice.set(room.parent_id, room.preco_base)
  }

  const waLink = settings.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}`
    : null
  const isMinimal = settings.template_id === 'minimal'
  const theme = siteTheme(settings)
  const faq = settings.secoes?.faq ?? []
  const lang = resolveLang(settings.idioma)
  /* Sem fotografia escolhida no editor, o topo usa a capa do primeiro
   * alojamento: um site com fotografias não abre num bloco de texto. */
  const heroImagem = settings.secoes?.hero_imagem ?? props.map(p => dadosDoCartao(p, allProps).foto).find(Boolean) ?? null
  const fotos = allProps
    .filter(p => p.ativo)
    .flatMap(p => fotosDe(p).map(url => ({ url, nome: p.nome })))
    .slice(0, 6)
  const galeriaVisivel = paginaFixaVisivel(settings.secoes, 'galeria')
  const basePath = await basePathDoSite(slug)
  const siteUrl = await baseUrlDoSite(slug)

  // Schema.org — um LodgingBusiness por alojamento ativo (ver docs/SAAS_ARCHITECTURE.md §6.3);
  // dados já existem em properties/website_settings, não pedidos extra ao anfitrião.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': props.map(p => ({
      '@type': 'LodgingBusiness',
      name: p.nome,
      description: p.descricao || settings.descricao || undefined,
      url: `${siteUrl}/alojamento/${p.id}`,
      image: fotosDe(p)[0] || undefined,
      telephone: settings.telefone || undefined,
      email: settings.email || undefined,
      priceRange: fmtMoney(minRoomPrice.get(p.id) ?? p.preco_base),
      address: {
        '@type': 'PostalAddress',
        streetAddress: p.mostrar_morada_publica ? p.endereco : undefined,
        addressLocality: p.cidade,
        addressCountry: 'PT',
      },
      amenityFeature: p.comodidades.map(a => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
    })),
  }

  const porque = itensPorque(settings.secoes, lang)
  const opinioes = settings.secoes?.opinioes ?? []
  const zonaTexto = settings.secoes?.zona_texto ?? ''
  const cidades = [...new Set(props.filter(p => p.ativo && p.cidade).map(p => p.cidade))]
  const localizacaoVisivel = paginaFixaVisivel(settings.secoes, 'localizacao')

  /* Cada secção da inicial, pronta a desenhar. `null` = não há nada para
   * mostrar (FAQ sem perguntas, anfitrião sem nome nem frase, nenhuma foto):
   * o site salta-a, o editor mostra um espaço vazio para a preencher. */
  const blocos: Record<SecaoInicio, ReactNode> = {
    alojamentos: props.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-3 text-center py-20">
        <p className="text-muted-foreground">{t(lang, 'listing_empty')}</p>
      </div>
    ) : (
      <section className="flex flex-col gap-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {listingAvailable(lang, props.length)}
        </p>
        {props.map(p => {
          const quartos = quartosDe(p.id, allProps)
          return (
            <div key={p.id} className="flex flex-col gap-10">
              <CartaoAlojamento a={dadosDoCartao(p, allProps)} href={`${basePath}/alojamento/${p.id}`} lang={lang} grande />
              {quartos.length > 0 && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {quartos.map(q => (
                    <CartaoAlojamento key={q.id} a={dadosDoCartao(q, allProps)} href={`${basePath}/alojamento/${q.id}`} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>
    ),

    fotos: fotos.length === 0 ? null : (
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {nomePaginaFixa(settings.secoes, 'galeria', lang)}
          </p>
          {galeriaVisivel && (
            <Link href={`${basePath}/galeria`} className="text-xs font-semibold text-primary inline-flex items-center gap-1">
              {lang === 'en' ? 'See all' : 'Ver todas'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <div key={`${f.url}-${i}`} className={`relative overflow-hidden bg-muted ${isMinimal ? 'rounded-md' : 'rounded-xl'} ${i === 0 ? 'col-span-2 row-span-2 aspect-square sm:aspect-auto' : 'aspect-square'} ${i === 5 ? 'hidden sm:block' : ''}`}>
              <Image src={f.url} alt={f.nome} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>
    ),

    porque: (
      <section className="border-t border-b border-border py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x sm:divide-border">
        {porque.map((item, i) => (
          <div key={i} className={`flex flex-col gap-1 ${i === 0 ? 'sm:pr-6' : i === 1 ? 'sm:px-6' : 'sm:pl-6'}`}>
            <p data-campo={`porque.${i}.titulo`} className="text-sm font-semibold">{item.titulo}</p>
            <p data-campo={`porque.${i}.texto`} className="text-xs text-muted-foreground leading-relaxed">{item.texto}</p>
          </div>
        ))}
      </section>
    ),

    opinioes: opinioes.length === 0 ? null : (
      <section className="flex flex-col gap-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t(lang, 'reviews_title')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opinioes.map((o, i) => (
            <figure key={i} className={`flex flex-col gap-3 border border-border bg-card p-5 ${isMinimal ? 'rounded-lg' : 'rounded-2xl'}`}>
              <blockquote className="text-sm leading-relaxed text-foreground/85">
                <span aria-hidden className="mr-0.5 text-primary text-lg leading-none">“</span>{o.texto}
              </blockquote>
              <figcaption className="mt-auto text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{o.nome || t(lang, 'review_guest')}</span>
                {o.origem && (
                  <> · {o.origem === 'direto' ? t(lang, 'review_direct') : `${t(lang, 'review_via')} ${NOME_ORIGEM[o.origem]}`}</>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    ),

    zona: !(zonaTexto || cidades.length > 0) ? null : (
      <section className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t(lang, 'area_title')}</p>
        {cidades.length > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary shrink-0" /> {cidades.join(' · ')}
          </p>
        )}
        {zonaTexto && (
          <div data-campo-paragrafos="zona_texto" className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
            {paragrafos(zonaTexto).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          </div>
        )}
        {localizacaoVisivel && (
          <Link href={`${basePath}/localizacao`} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary">
            {t(lang, 'see_location')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </section>
    ),

    faq: faq.length === 0 ? null : (
      <section className="flex flex-col gap-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t(lang, 'faq_title')}</p>
        <div className="flex flex-col divide-y divide-border border-t border-b border-border">
          {faq.map((item, i) => (
            <details key={i} className="group py-4">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-semibold text-sm">
                {item.pergunta}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{item.resposta}</p>
            </details>
          ))}
        </div>
      </section>
    ),

    anfitriao: !(settings.host_nome || settings.host_bio) ? null : (
      <section className="flex flex-col items-center text-center gap-5">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">
            {(settings.host_nome || settings.nome).slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div>
          <p data-campo="host_nome" className="font-bold text-lg">{settings.host_nome || settings.nome}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t(lang, 'host_role')}</p>
        </div>
        {settings.host_bio && (
          <p data-campo="host_bio" className="text-sm text-muted-foreground leading-relaxed max-w-md">{settings.host_bio}</p>
        )}
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#075E54] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            {WA_SVG}
            {t(lang, 'talk_to_host')}
          </a>
        )}
      </section>
    ),
  }

  return (
    <div lang={htmlLang(lang)} className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      {props.some(p => p.ativo) && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}

      <SiteNav slug={slug} settings={settings} active="" />

      {/* Hero — a fotografia escolhida no editor ou, sem ela, a capa do
          primeiro alojamento. Com fotografia, o nome da casa assenta sobre ela;
          sem nenhuma, o topo é só tipografia. */}
      {heroImagem ? (
        <section data-secao="hero" className="relative isolate flex min-h-[72svh] items-end overflow-hidden text-white">
          <Image src={heroImagem} alt="" fill priority sizes="100vw" className="object-cover -z-20" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-12 pt-32 sm:pb-16">
            {!isMinimal && (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/75">{t(lang, 'hero_badge')}</p>
            )}
            <h1 data-campo="nome" className="site-titulo max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
              {settings.nome}
            </h1>
            {(settings.descricao || modoEditor) && (
              <p data-campo="descricao" className="max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                {settings.descricao}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section data-secao="hero">
          <div className={`mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 ${isMinimal ? 'items-start pt-10 pb-6 text-left' : 'items-center pt-16 pb-12 text-center sm:pt-24'}`}>
            {!isMinimal && (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{t(lang, 'hero_badge')}</p>
            )}
            <h1 data-campo="nome" className={`site-titulo max-w-3xl font-semibold leading-[1.05] ${isMinimal ? 'text-3xl lg:text-4xl' : 'text-5xl sm:text-6xl'}`}>
              {settings.nome}
            </h1>
            {(settings.descricao || modoEditor) && (
              <p data-campo="descricao" className={`max-w-xl leading-relaxed text-muted-foreground ${isMinimal ? 'text-sm' : 'text-base sm:text-lg'}`}>
                {settings.descricao}
              </p>
            )}
          </div>
        </section>
      )}

      <main data-secoes-inicio className={`flex-1 max-w-6xl mx-auto w-full px-4 pb-20 flex flex-col gap-20 ${heroImagem ? 'pt-14' : ''}`}>
        {secoesDoInicio(settings.secoes)
          .filter(s => s.visivel || modoEditor)
          .map(({ id, visivel }) => {
            const conteudo = blocos[id]
            if (!conteudo && !modoEditor) return null
            return (
              <div key={id} data-secao={id} hidden={!visivel || undefined}>
                {conteudo ?? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    Secção vazia — preenche-a no editor para aparecer aos hóspedes.
                  </p>
                )}
              </div>
            )
          })}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
