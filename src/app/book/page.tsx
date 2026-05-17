'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BedDouble, Users, Bath, MapPin, ArrowRight, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees } from 'lucide-react'
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

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Hero */}
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative max-w-3xl mx-auto px-4 py-12 lg:py-20 flex flex-col items-center text-center gap-4">
          {brandName && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60 mb-1">
              {brandName}
            </span>
          )}
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
            {settings.nome}
          </h1>
          {settings.descricao && (
            <p className="text-primary-foreground/80 text-base lg:text-lg max-w-lg leading-relaxed">
              {settings.descricao}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1 px-3 py-1.5 rounded-full bg-primary-foreground/10 backdrop-blur-sm text-xs font-medium text-primary-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Reservas diretas sem comissões
          </div>
          {(settings.email || settings.telefone) && (
            <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
              {settings.email && (
                <a href={`mailto:${settings.email}`}
                  className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  ✉ {settings.email}
                </a>
              )}
              {settings.telefone && (
                <a href={`https://wa.me/${settings.telefone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  WhatsApp {settings.telefone}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Listings */}
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
            <p className="text-muted-foreground">Nenhum alojamento disponível neste momento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {props.length} {props.length === 1 ? 'alojamento' : 'alojamentos'}
              </h2>
            </div>

            {props.map(p => (
              <Link key={p.id} href={`/book/${p.id}`}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-200">
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: p.cor }} />

                <div className="p-5 flex flex-col gap-4">
                  {/* Title + price row */}
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
                        {p.endereco && <span>· {p.endereco}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold" style={{ color: p.cor }}>{fmtMoney(p.preco_base)}</p>
                      <p className="text-xs text-muted-foreground">por noite</p>
                    </div>
                  </div>

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
                        <span className="text-[11px] text-muted-foreground self-center">
                          +{p.comodidades.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {settings.min_noites > 1 ? `Mín. ${settings.min_noites} noites` : 'Estadia mínima 1 noite'}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                      Ver datas <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          {brandName} · Reservas diretas, sem comissões
        </p>
        {(settings.email || settings.telefone) && (
          <div className="flex items-center justify-center gap-4 mt-2">
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
