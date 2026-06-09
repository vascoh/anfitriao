import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { BedDouble, Users, Bath, MapPin, ArrowRight, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import { adminGetWebsiteSettingsBySlug, adminGetProperties } from '@/lib/db-admin'
import type { Property, WebsiteSettings } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

// ─── Metadata (SEO) ───────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt'

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
      locale: 'pt_PT',
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
const WA_SVG = (
  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

// ─── PropertyCard ─────────────────────────────────────────────────────────────

function PropertyCard({ p, minNights, slug }: { p: Property; minNights: number; slug: string }) {
  // Link to the booking detail page (still served under /book/[id])
  const href = `/book/${p.id}`

  return (
    <Link href={href}
      className="group block rounded-2xl overflow-hidden border border-border hover:shadow-xl hover:border-primary/15 transition-all duration-300">

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
                <p className="text-3xl font-bold text-white leading-none">{fmtMoney(p.preco_base)}</p>
                <p className="text-white/60 text-xs mt-0.5">
                  por noite{p.taxa_limpeza && p.taxa_limpeza > 0 ? ` · ${fmtMoney(p.taxa_limpeza)} limpeza` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 flex items-center gap-4" style={{ backgroundColor: p.cor + '12' }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: p.cor + '20' }}>
            <span className="text-2xl">🏠</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{p.nome}</p>
            <p className="text-xs text-muted-foreground">{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold" style={{ color: p.cor }}>{fmtMoney(p.preco_base)}</p>
            <p className="text-xs text-muted-foreground">/ noite</p>
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
            <Users className="h-3.5 w-3.5" />até {p.capacidade}
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
          Reservar <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      {minNights > 1 && (
        <div className="px-5 py-2 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">Mínimo {minNights} noites</p>
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

  const props = settings.owner_id
    ? await adminGetProperties(settings.owner_id as string)
    : []

  const brandName = settings.logo_texto || settings.nome
  const waLink = settings.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}`
    : null

  return (
    <div className="min-h-dvh bg-background flex flex-col">

      {/* Top nav */}
      <nav className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-bold text-sm tracking-tight">{brandName}</span>
          <div className="flex items-center gap-3">
            {settings.email && (
              <a href={`mailto:${settings.email}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                {settings.email}
              </a>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                {WA_SVG}
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto w-full px-4 pt-16 pb-10 flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Reservas diretas · Sem comissões
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight leading-tight max-w-xl">
          {settings.nome}
        </h1>
        {settings.descricao && (
          <p className="text-muted-foreground text-base lg:text-lg max-w-lg leading-relaxed">
            {settings.descricao}
          </p>
        )}
      </section>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-20 flex flex-col gap-16">

        {/* Property listings */}
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-20">
            <p className="text-muted-foreground">Nenhum alojamento disponível neste momento.</p>
          </div>
        ) : (
          <section className="flex flex-col gap-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {props.length === 1 ? '1 alojamento disponível' : `${props.length} alojamentos disponíveis`}
            </p>
            {props.map(p => (
              <PropertyCard key={p.id} p={p} minNights={settings.min_noites} slug={slug} />
            ))}
          </section>
        )}

        {/* Why book direct */}
        <section className="border-t border-b border-border py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-1 sm:pr-6">
            <p className="text-sm font-semibold">Sem taxas de serviço</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reservar diretamente significa pagar menos. Sem comissões para plataformas de terceiros.
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:px-6">
            <p className="text-sm font-semibold">Contacto direto</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Comunicação direta com o anfitrião. Pedidos especiais atendidos com mais atenção.
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:pl-6">
            <p className="text-sm font-semibold">Cancelamento flexível</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Políticas e pagamento acordados diretamente com o anfitrião, sem burocracia.
            </p>
          </div>
        </section>

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
              <p className="text-xs text-muted-foreground mt-0.5">Anfitrião</p>
            </div>
            {settings.host_bio && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{settings.host_bio}</p>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                {WA_SVG}
                Falar com o anfitrião
              </a>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground text-sm">{brandName}</span>
          <div className="flex items-center gap-4 flex-wrap">
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="hover:text-foreground transition-colors">
                {settings.email}
              </a>
            )}
            {settings.telefone && (
              <a href={`tel:${settings.telefone}`} className="hover:text-foreground transition-colors">
                {settings.telefone}
              </a>
            )}
            <span className="opacity-40">Powered by Anfitrião</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
