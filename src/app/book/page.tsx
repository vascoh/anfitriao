'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BedDouble, Users, Bath, MapPin, ArrowRight, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees, Shield, Tag, MessageCircle } from 'lucide-react'
import { store, fmtMoney } from '@/lib/store'
import type { Property, WebsiteSettings } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const AMENITY_ICON: Record<string, React.ReactNode> = {
  wifi: <Wifi className="h-3 w-3" />,
  ar_condicionado: <Wind className="h-3 w-3" />,
  estacionamento: <Car className="h-3 w-3" />,
  piscina: <Waves className="h-3 w-3" />,
  cozinha: <UtensilsCrossed className="h-3 w-3" />,
  maquina_lavar: <WashingMachine className="h-3 w-3" />,
  tv: <Tv className="h-3 w-3" />,
  jardim: <Trees className="h-3 w-3" />,
}

const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Wi-Fi',
  ar_condicionado: 'AC',
  estacionamento: 'Estacionamento',
  piscina: 'Piscina',
  cozinha: 'Cozinha',
  maquina_lavar: 'Lavar roupa',
  secador: 'Secador',
  tv: 'TV',
  varanda: 'Varanda',
  jardim: 'Jardim',
}

const VANTAGENS = [
  {
    icon: <Tag className="h-5 w-5" />,
    titulo: 'Sem taxas de serviço',
    desc: 'Reservar diretamente significa pagar menos — sem comissões para plataformas.',
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    titulo: 'Contacto direto',
    desc: 'Comunicação direta com o anfitrião. Pedidos especiais atendidos com mais atenção.',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    titulo: 'Flexibilidade',
    desc: 'Políticas de cancelamento mais flexíveis e pagamento acordado diretamente.',
  },
]

export default function BookPage() {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [props, setProps] = useState<Property[]>([])

  useEffect(() => {
    setSettings(store.getWebsiteSettings())
    setProps(store.getProperties().filter(p => p.ativo))
  }, [])

  if (!settings) return null

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
          O website de reservas não está disponível neste momento. Por favor tente mais tarde.
        </p>
      </div>
    )
  }

  const brandName = settings.logo_texto || settings.nome
  const waLink = settings.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}`
    : null

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Hero */}
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 60%, white 1px, transparent 1px), radial-gradient(circle at 75% 30%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative max-w-3xl mx-auto px-4 py-14 lg:py-24 flex flex-col items-center text-center gap-5">
          {brandName && (
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary-foreground/50">
              {brandName}
            </span>
          )}
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
            {settings.nome}
          </h1>
          {settings.descricao && (
            <p className="text-primary-foreground/75 text-base lg:text-lg max-w-xl leading-relaxed">
              {settings.descricao}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-foreground/10 text-xs font-semibold text-primary-foreground/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Reservas diretas · Sem comissões
            </span>
          </div>
          {(settings.email || settings.telefone) && (
            <div className="flex items-center justify-center gap-4 flex-wrap text-sm mt-1">
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="text-primary-foreground/65 hover:text-primary-foreground transition-colors">
                  ✉ {settings.email}
                </a>
              )}
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="text-primary-foreground/65 hover:text-primary-foreground transition-colors">
                  WhatsApp {settings.telefone}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-10 px-4 py-10 max-w-3xl mx-auto w-full">

        {/* Property listings */}
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
            <p className="text-muted-foreground">Nenhum alojamento disponível neste momento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {props.length} {props.length === 1 ? 'alojamento disponível' : 'alojamentos disponíveis'}
            </h2>

            {props.map(p => (
              <Link key={p.id} href={`/book/${p.id}`}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:border-primary/20 transition-all duration-200">

                {/* Photo or color bar */}
                {p.imagem_url ? (
                  <div className="relative h-52 lg:h-64 overflow-hidden bg-muted">
                    <img
                      src={p.imagem_url}
                      alt={p.nome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="text-white font-bold text-lg leading-tight drop-shadow">{p.nome}</p>
                        <div className="flex items-center gap-1 text-white/80 text-xs mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span>{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-2xl font-bold text-white drop-shadow">{fmtMoney(p.preco_base)}</p>
                        <p className="text-white/70 text-xs">por noite</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-2 w-full" style={{ backgroundColor: p.cor }} />
                )}

                <div className="p-5 flex flex-col gap-4">
                  {/* Title row (only when no image) */}
                  {!p.imagem_url && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {PROPERTY_TYPE_LABEL[p.tipo]}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg leading-tight">{p.nome}</h3>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{p.cidade}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold" style={{ color: p.cor }}>{fmtMoney(p.preco_base)}</p>
                        <p className="text-xs text-muted-foreground">por noite</p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {p.descricao && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{p.descricao}</p>
                  )}

                  {/* Specs */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {p.quartos > 0 && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5" />
                        {p.quartos} quarto{p.quartos !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" />
                      {p.casasBanho} WC
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Máx. {p.capacidade}
                    </span>
                  </div>

                  {/* Amenities */}
                  {p.comodidades.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.comodidades.slice(0, 6).map(a => (
                        <span key={a} className="flex items-center gap-1 text-[11px] bg-muted/60 text-foreground/60 px-2 py-1 rounded-full">
                          {AMENITY_ICON[a] ?? null}
                          {AMENITY_LABEL[a] ?? a.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {p.comodidades.length > 6 && (
                        <span className="text-[11px] text-muted-foreground self-center">+{p.comodidades.length - 6}</span>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {settings.min_noites > 1 ? `Mín. ${settings.min_noites} noites` : 'Estadia mínima 1 noite'}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      Ver disponibilidade <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Why book direct */}
        <div className="flex flex-col gap-5">
          <h2 className="text-base font-bold tracking-tight text-center">Porquê reservar diretamente?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {VANTAGENS.map(v => (
              <div key={v.titulo} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {v.icon}
                </div>
                <p className="font-semibold text-sm">{v.titulo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Host section */}
        {(settings.host_nome || settings.host_bio) && (
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {(settings.host_nome ?? settings.nome).slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold">{settings.host_nome ?? settings.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Anfitrião</p>
            </div>
            {settings.host_bio && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{settings.host_bio}</p>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Falar com o anfitrião
              </a>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border px-4 py-8 text-center bg-muted/30">
        <p className="text-sm font-semibold">{brandName}</p>
        <p className="text-xs text-muted-foreground mt-1">Reservas diretas · Sem comissões</p>
        {(settings.email || settings.telefone) && (
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {settings.email}
              </a>
            )}
            {settings.telefone && (
              <a href={`tel:${settings.telefone}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {settings.telefone}
              </a>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}
