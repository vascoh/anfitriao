import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { BedDouble, Users, Bath, MapPin, ArrowRight, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees, Home } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import { adminGetWebsiteSettingsBySlug, adminGetProperties } from '@/lib/db-admin'
import type { Property } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'
import { APP_URL } from '@/lib/config'
import { siteTheme } from '@/lib/site-theme'
import { SiteNav, SiteFooter, WA_SVG } from './_components/site-chrome'
import { resolveLang, t, listingAvailable, minNights as minNightsLabel, type SiteLang } from '@/lib/i18n'

// ─── Metadata (SEO) ───────────────────────────────────────────────────────────


export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings) return { title: 'Reservas' }

  const title = settings.nome
  const description = settings.descricao || `Reserve diretamente em ${settings.nome}. Sem comissões.`
  const ogImage = `${APP_URL}/api/og?title=${encodeURIComponent(title)}`

  return {
    title,
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
    robots: { index: false, follow: false },
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const AMENITY_ICON: Record<string, React.ReactNode> = {
  wifi:            <Wifi className="h-3 w-3" />,
  ar_condicionado: <Wind className="h-3 w-3" />,
  estacionamento:  <Car className="h-3 w-3" />,
  piscina:         <Waves className="h-3 w-3" />,
  cozinha:         <UtensilsCrossed className="h-3 w-3" />,
  maquina_lavar:   <WashingMachine className="h-3 w-3" />,
  tv:              <Tv className="h-3 w-3" />,
  jardim:          <Trees className="h-3 w-3" />,
}
const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Wi-Fi', ar_condicionado: 'AC', estacionamento: 'Estacionamento',
  piscina: 'Piscina', cozinha: 'Cozinha', maquina_lavar: 'Lavandaria',
  secador: 'Secador', tv: 'TV', varanda: 'Varanda', jardim: 'Jardim',
}
// ─── PropertyCard ─────────────────────────────────────────────────────────────

function PropertyCard({ p, minNights, desde, minimal, lang }: { p: Property; minNights: number; desde?: number; minimal?: boolean; lang: SiteLang }) {
  // Link to the booking detail page (still served under /book/[id])
  const href = `/book/${p.id}`
  // Casa com quartos: mostrar "desde" o preço do quarto mais barato
  const preco = desde ?? p.preco_base
  const prefixo = desde !== undefined ? 'desde ' : ''
  const rounding = minimal ? 'rounded-lg' : 'rounded-2xl'

  return (
    <Link href={href}
      className={`group block ${rounding} overflow-hidden border border-border ${minimal ? 'hover:border-primary/30' : 'hover:shadow-xl hover:border-primary/15'} transition-all duration-300`}>

      {p.imagem_url ? (
        <div className="relative h-60 lg:h-72 overflow-hidden bg-muted">
          <Image
            src={p.imagem_url}
            alt={p.nome}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-white font-bold text-xl leading-tight">{p.nome}</p>
                <div className="flex items-center gap-1 text-white/70 text-xs mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold text-white leading-none">{prefixo}{fmtMoney(preco)}</p>
                <p className="text-white/60 text-xs mt-0.5">
                  {t(lang, 'per_night')}{p.taxa_limpeza && p.taxa_limpeza > 0 ? ` · ${fmtMoney(p.taxa_limpeza)} ${t(lang, 'cleaning_fee')}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ backgroundColor: p.cor + '12' }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: p.cor + '20' }}>
              <Home className="h-5 w-5" style={{ color: p.cor }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-lg">{p.nome}</p>
              <p className="text-xs text-muted-foreground">{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</p>
            </div>
          </div>
          <div className="sm:ml-auto sm:text-right shrink-0">
            <p className="text-2xl font-bold" style={{ color: p.cor }}>{prefixo}{fmtMoney(preco)}</p>
            <p className="text-xs text-muted-foreground">/ {t(lang, 'per_night')}</p>
          </div>
        </div>
      )}

      <div className="px-5 py-3.5 flex items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-4 text-xs text-muted-foreground min-w-0">
          {p.quartos > 0 && (
            <span className="flex items-center gap-1 shrink-0">
              <BedDouble className="h-3.5 w-3.5" />{p.quartos}q
            </span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            <Bath className="h-3.5 w-3.5" />{p.casasBanho}wc
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Users className="h-3.5 w-3.5" />{t(lang, 'up_to')} {p.capacidade}
          </span>
          <div className="hidden sm:flex items-center gap-3 overflow-hidden">
            {p.comodidades.slice(0, 4).map(a => (
              <span key={a} className="flex items-center gap-0.5 shrink-0">
                {AMENITY_ICON[a] ?? null}
                <span className="hidden md:inline">{AMENITY_LABEL[a] ?? a}</span>
              </span>
            ))}
          </div>
        </div>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all duration-200 shrink-0">
          {t(lang, 'reservar')} <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      {minNights > 1 && (
        <div className="px-5 py-2 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">{minNightsLabel(lang, minNights)}</p>
        </div>
      )}
    </Link>
  )
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default async function ReservasPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)

  if (!settings) notFound()

  if (!settings.enabled) {
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
  const props = allProps.filter(p => !p.parent_id)
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

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>

      <SiteNav slug={slug} settings={settings} active="" />

      {/* Hero */}
      <section className={`max-w-3xl mx-auto w-full px-4 flex flex-col gap-4 ${isMinimal ? 'pt-10 pb-6 items-start text-left' : 'pt-16 pb-10 items-center text-center'}`}>
        {!isMinimal && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t(lang, 'hero_badge')}
          </div>
        )}
        <h1 className={`font-bold tracking-tight leading-tight max-w-xl ${isMinimal ? 'text-3xl lg:text-4xl' : 'text-4xl lg:text-5xl'}`}>
          {settings.nome}
        </h1>
        {settings.descricao && (
          <p className={`text-muted-foreground leading-relaxed max-w-lg ${isMinimal ? 'text-sm' : 'text-base lg:text-lg'}`}>
            {settings.descricao}
          </p>
        )}
      </section>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-20 flex flex-col gap-16">

        {/* Property listings */}
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-20">
            <p className="text-muted-foreground">{t(lang, 'listing_empty')}</p>
          </div>
        ) : (
          <section className="flex flex-col gap-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {listingAvailable(lang, props.length)}
            </p>
            {props.map(p => (
              <PropertyCard key={p.id} p={p} minNights={settings.min_noites} desde={minRoomPrice.get(p.id)} minimal={isMinimal} lang={lang} />
            ))}
          </section>
        )}

        {/* Why book direct */}
        <section className="border-t border-b border-border py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-1 sm:pr-6">
            <p className="text-sm font-semibold">{t(lang, 'why_title_1')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t(lang, 'why_body_1')}</p>
          </div>
          <div className="flex flex-col gap-1 sm:px-6">
            <p className="text-sm font-semibold">{t(lang, 'why_title_2')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t(lang, 'why_body_2')}</p>
          </div>
          <div className="flex flex-col gap-1 sm:pl-6">
            <p className="text-sm font-semibold">{t(lang, 'why_title_3')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t(lang, 'why_body_3')}</p>
          </div>
        </section>

        {/* FAQ */}
        {faq.length > 0 && (
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
        )}

        {/* Host section */}
        {(settings.host_nome || settings.host_bio) && (
          <section className="flex flex-col items-center text-center gap-5">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {(settings.host_nome ?? settings.nome).slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold text-lg">{settings.host_nome ?? settings.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t(lang, 'host_role')}</p>
            </div>
            {settings.host_bio && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{settings.host_bio}</p>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#075E54] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                {WA_SVG}
                {t(lang, 'talk_to_host')}
              </a>
            )}
          </section>
        )}
      </main>

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}
