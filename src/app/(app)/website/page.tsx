'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Globe, ExternalLink, Copy, Check, ToggleLeft, ToggleRight, ArrowRight } from 'lucide-react'
import { store, fmtMoney, fmtDate, nights } from '@/lib/store'
import type { WebsiteSettings } from '@/lib/types'

function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin
}

export default function WebsitePage() {
  const origin = useOrigin()
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(store.getWebsiteSettings())
  }, [])

  const publicUrl = `${origin}/book`

  function update<K extends keyof WebsiteSettings>(key: K, val: WebsiteSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: val } : prev)
    setSaved(false)
  }

  function save() {
    if (!settings) return
    store.saveWebsiteSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Stats from direct bookings
  const allBookings = store.getBookings()
  const directBookings = allBookings.filter(b => b.origem === 'direto' && b.estado !== 'cancelada')
  const totalRevenue = directBookings.reduce((s, b) => s + b.preco_total, 0)
  const props = store.getProperties()
  const guests = store.getGuests()

  if (!settings) return null

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 lg:px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3 max-w-3xl">
          <Globe className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-2xl font-semibold tracking-tight flex-1">Website de reservas</h1>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 lg:p-8 max-w-3xl">
        {/* Enable toggle */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm">Website público</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {settings.enabled
                ? 'Os hóspedes podem fazer reservas online diretamente.'
                : 'O website está desativado. Os hóspedes não conseguem aceder.'}
            </p>
          </div>
          <button onClick={() => update('enabled', !settings.enabled)}
            className={`shrink-0 transition-colors ${settings.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
            {settings.enabled
              ? <ToggleRight className="h-8 w-8" />
              : <ToggleLeft className="h-8 w-8" />}
          </button>
        </div>

        {/* Public URL */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">URL do website</p>
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="flex-1 text-sm font-mono text-foreground/70 truncate">{publicUrl}</span>
            <button onClick={copyUrl} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir website
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Reservas diretas</p>
            <p className="text-2xl font-bold mt-0.5">{directBookings.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Receita direta</p>
            <p className="text-2xl font-bold mt-0.5">{fmtMoney(totalRevenue)}</p>
          </div>
        </div>

        {/* Settings form */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurações</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome do website</label>
            <input type="text" value={settings.nome} onChange={e => update('nome', e.target.value)}
              placeholder="Ex: Apartamentos Lisboa"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição / slogan</label>
            <textarea value={settings.descricao} onChange={e => update('descricao', e.target.value)} rows={2}
              placeholder="Reserve diretamente connosco..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Email de contacto</label>
              <input type="email" value={settings.email} onChange={e => update('email', e.target.value)}
                placeholder="host@exemplo.com"
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Telefone / WhatsApp</label>
              <input type="tel" value={settings.telefone} onChange={e => update('telefone', e.target.value)}
                placeholder="+351 912 345 678"
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Mínimo de noites</label>
              <input type="number" min={1} max={30} value={settings.min_noites}
                onChange={e => update('min_noites', Number(e.target.value))}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Antecedência mínima (dias)</label>
              <input type="number" min={0} max={60} value={settings.antecedencia_dias}
                onChange={e => update('antecedencia_dias', Number(e.target.value))}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        <button onClick={save}
          className={`w-full rounded-xl py-3.5 font-semibold text-sm transition-colors ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-primary text-primary-foreground active:opacity-80'
          }`}>
          {saved ? '✓ Guardado' : 'Guardar configurações'}
        </button>

        {/* Properties on the website */}
        {settings.enabled && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Propriedades publicadas</p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {props.filter(p => p.ativo).length === 0 ? (
                <div className="px-4 py-3.5 text-sm text-muted-foreground">
                  Sem propriedades ativas. Ativa uma propriedade para aparecer no website.
                </div>
              ) : (
                props.filter(p => p.ativo).map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                    <span className="flex-1 text-sm font-medium truncate">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{p.cidade}</span>
                    <a href={`/book/${p.id}`} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-primary hover:text-primary/80 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
            {props.filter(p => p.ativo).length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {props.filter(p => p.ativo).length} propriedade{props.filter(p => p.ativo).length !== 1 ? 's' : ''} visível{props.filter(p => p.ativo).length !== 1 ? 'eis' : ''} em{' '}
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-medium">/book</a>
              </p>
            )}
          </div>
        )}

        {/* Recent direct bookings */}
        {directBookings.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Reservas recentes (diretas)</p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {directBookings.slice(0, 5).map(b => {
                const g = guests.find(x => x.id === b.hospede_id)
                const p = props.find(x => x.id === b.propriedade_id)
                const n = nights(b.check_in, b.check_out)
                return (
                  <Link key={b.id} href={`/reservas/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g?.nome ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{p?.nome} · {fmtDate(b.check_in)} · {n}n</p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{fmtMoney(b.preco_total)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
