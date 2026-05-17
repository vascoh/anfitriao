'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BedDouble, Users, MapPin, ArrowRight } from 'lucide-react'
import { store, fmtMoney } from '@/lib/store'
import type { Property, WebsiteSettings } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

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

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-8 lg:py-12 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{settings.nome}</h1>
          <p className="mt-2 text-primary-foreground/80 text-sm lg:text-base">{settings.descricao}</p>
          {(settings.email || settings.telefone) && (
            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  ✉ {settings.email}
                </a>
              )}
              {settings.telefone && (
                <a href={`tel:${settings.telefone}`} className="text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  ☎ {settings.telefone}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Properties */}
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
            <p className="text-muted-foreground">Nenhuma propriedade disponível neste momento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {props.length} {props.length === 1 ? 'alojamento disponível' : 'alojamentos disponíveis'}
            </h2>
            {props.map(p => (
              <Link key={p.id} href={`/book/${p.id}`}
                className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow active:bg-muted/40">
                {/* Color accent */}
                <div className="h-2 w-full" style={{ backgroundColor: p.cor }} />
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-base leading-tight">{p.nome}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-primary">{fmtMoney(p.preco_base)}</p>
                      <p className="text-xs text-muted-foreground">por noite</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      {p.quartos} quarto{p.quartos !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Máx. {p.capacidade} hóspedes
                    </span>
                  </div>

                  {p.comodidades.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.comodidades.slice(0, 4).map(a => (
                        <span key={a} className="text-[11px] bg-muted/60 text-foreground/60 px-2 py-0.5 rounded-full">
                          {a.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {p.comodidades.length > 4 && (
                        <span className="text-[11px] text-muted-foreground">+{p.comodidades.length - 4}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {settings.min_noites > 1 ? `Mín. ${settings.min_noites} noites` : 'Estadia flexível'}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                      Ver disponibilidade <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        Powered by Anfitrião · Reservas sem comissões
      </footer>
    </div>
  )
}
