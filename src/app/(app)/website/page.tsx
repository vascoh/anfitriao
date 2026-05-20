'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Globe, ExternalLink, Copy, Check, ToggleLeft, ToggleRight, ArrowRight, RefreshCw, Download, Plus, Trash2, AlertCircle, CheckCircle2, Rss } from 'lucide-react'
import { fmtMoney, fmtDate, nights, uuid } from '@/lib/store'
import { db } from '@/lib/db'
import { parseIcal, generateIcal } from '@/lib/ical'
import type { WebsiteSettings, Property, IcalFeed } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'

function useOrigin() {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin
}

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

export default function WebsitePage() {
  const origin = useOrigin()
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [props, setProps] = useState<Property[]>([])
  const [allBookings, setAllBookings] = useState<import('@/lib/types').Booking[]>([])
  const [allGuests, setAllGuests] = useState<import('@/lib/types').Guest[]>([])
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const [subscribeCopied, setSubscribeCopied] = useState<Record<string, boolean>>({})
  const [newFeedUrl, setNewFeedUrl] = useState<Record<string, string>>({})
  const [newFeedSource, setNewFeedSource] = useState<Record<string, string>>({})

  useEffect(() => {
    db.getWebsiteSettings().then(setSettings)
    db.getProperties().then(setProps)
    db.getBookings().then(setAllBookings)
    db.getGuests().then(setAllGuests)
  }, [])

  const publicUrl = `${origin}/book`

  function update<K extends keyof WebsiteSettings>(key: K, val: WebsiteSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: val } : prev)
    setSaved(false)
  }

  async function save() {
    if (!settings) return
    await db.saveWebsiteSettings(settings)
    setSaved(true)
    toast.success('Configurações guardadas')
    setTimeout(() => setSaved(false), 2000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success('URL copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  async function syncFeed(prop: Property, feed: IcalFeed) {
    const key = `${prop.id}:${feed.id}`
    setSyncStates(s => ({ ...s, [key]: 'loading' }))
    try {
      const res = await fetch(`/api/ical-proxy?url=${encodeURIComponent(feed.url)}`)
      if (!res.ok) throw new Error('Fetch failed')
      const text = await res.text()
      const events = parseIcal(text)

      const bookings = await db.getBookings()
      let added = 0

      for (const ev of events) {
        const exists = bookings.some(b =>
          b.propriedade_id === prop.id &&
          b.notas?.includes(ev.uid)
        )
        if (exists) continue

        const guestId = uuid()
        await db.saveGuest({
          id: guestId,
          nome: ev.summary || `${SOURCE_LABEL[feed.source as keyof typeof SOURCE_LABEL]} Guest`,
          tags: ['novo'],
          criado_em: new Date().toISOString(),
        })
        await db.saveBooking({
          id: uuid(),
          propriedade_id: prop.id,
          hospede_id: guestId,
          check_in: ev.start,
          check_out: ev.end,
          num_hospedes: 1,
          estado: 'confirmada',
          origem: feed.source as IcalFeed['source'],
          preco_total: 0,
          preco_pago: 0,
          notas: `Importado via iCal — UID: ${ev.uid}`,
          criado_em: new Date().toISOString(),
          historico: [{
            id: uuid(),
            data: new Date().toISOString(),
            tipo: 'criada',
            descricao: `Importado via iCal de ${feed.nome}`,
          }],
        })
        added++
      }

      const updatedFeed: IcalFeed = {
        ...feed,
        last_sync: new Date().toISOString(),
        last_count: events.length,
        error: undefined,
      }
      const updatedProp: Property = {
        ...prop,
        ical_feeds: (prop.ical_feeds ?? []).map(f => f.id === feed.id ? updatedFeed : f),
      }
      await db.saveProperty(updatedProp)
      setProps(await db.getProperties())
      setSyncStates(s => ({ ...s, [key]: 'ok' }))
      toast.success(added > 0 ? `${added} reserva${added !== 1 ? 's' : ''} importada${added !== 1 ? 's' : ''}` : 'Sincronizado — sem novidades')
      setTimeout(() => setSyncStates(s => ({ ...s, [key]: 'idle' })), 2000)
    } catch {
      const updatedFeed: IcalFeed = { ...feed, error: 'Falha ao sincronizar', last_sync: new Date().toISOString() }
      const updatedProp: Property = {
        ...prop,
        ical_feeds: (prop.ical_feeds ?? []).map(f => f.id === feed.id ? updatedFeed : f),
      }
      await db.saveProperty(updatedProp)
      setProps(await db.getProperties())
      setSyncStates(s => ({ ...s, [key]: 'error' }))
      toast.error('Falha ao sincronizar o feed iCal')
      setTimeout(() => setSyncStates(s => ({ ...s, [key]: 'idle' })), 3000)
    }
  }

  async function addFeed(prop: Property) {
    const url = newFeedUrl[prop.id]?.trim()
    if (!url) return
    const source = (newFeedSource[prop.id] || 'outro') as IcalFeed['source']
    const feed: IcalFeed = {
      id: uuid(),
      url,
      source,
      nome: SOURCE_LABEL[source],
    }
    const updated: Property = { ...prop, ical_feeds: [...(prop.ical_feeds ?? []), feed] }
    await db.saveProperty(updated)
    setProps(await db.getProperties())
    setNewFeedUrl(s => ({ ...s, [prop.id]: '' }))
    setNewFeedSource(s => ({ ...s, [prop.id]: '' }))
  }

  async function removeFeed(prop: Property, feedId: string) {
    const updated: Property = { ...prop, ical_feeds: (prop.ical_feeds ?? []).filter(f => f.id !== feedId) }
    await db.saveProperty(updated)
    setProps(await db.getProperties())
  }

  function exportIcal(prop: Property) {
    const bookings = allBookings.filter(b =>
      b.propriedade_id === prop.id && b.estado !== 'cancelada' && b.estado !== 'no_show'
    )
    const events = bookings.map(b => {
      const g = allGuests.find(x => x.id === b.hospede_id)
      return { uid: `${b.id}@anfitriao`, summary: g?.nome ?? 'Reservado', start: b.check_in, end: b.check_out }
    })
    const ics = generateIcal(events, prop.nome)
    const blob = new Blob([ics], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${prop.nome.replace(/\s+/g, '-').toLowerCase()}.ics`
    a.click()
  }

  const directBookings = allBookings.filter(b => b.origem === 'direto' && b.estado !== 'cancelada')
  const totalRevenue = directBookings.reduce((s, b) => s + b.preco_total, 0)
  const commissionSaved = Math.round(totalRevenue * 0.15)
  const guests = allGuests

  if (!settings) return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 lg:px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3 max-w-3xl">
          <Globe className="h-5 w-5 text-primary shrink-0" />
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        </div>
      </header>
    </div>
  )

  const activeSources: Array<{ value: IcalFeed['source'], label: string }> = [
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'vrbo', label: 'VRBO' },
    { value: 'outro', label: 'Outro' },
  ]

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
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary font-medium w-fit">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir website
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Reservas diretas</p>
            <p className="text-2xl font-bold mt-0.5">{directBookings.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Receita direta</p>
            <p className="text-2xl font-bold mt-0.5">{fmtMoney(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Poupado em comissões</p>
            <p className="text-2xl font-bold mt-0.5 text-emerald-600">{fmtMoney(commissionSaved)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs Airbnb 15%</p>
          </div>
        </div>

        {/* Settings form */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Identidade</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome / Marca</label>
            <input type="text" value={settings.logo_texto ?? ''} onChange={e => update('logo_texto', e.target.value)}
              placeholder="Ex: Casa de Vasco"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Título do website</label>
            <input type="text" value={settings.nome} onChange={e => update('nome', e.target.value)}
              placeholder="Ex: Apartamentos Lisboa — Reserve Diretamente"
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
              <label className="text-xs text-muted-foreground font-medium">Nome do anfitrião</label>
              <input type="text" value={settings.host_nome ?? ''} onChange={e => update('host_nome', e.target.value)}
                placeholder="Ex: Vasco Henriques"
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Frase do anfitrião</label>
              <input type="text" value={settings.host_bio ?? ''} onChange={e => update('host_bio', e.target.value)}
                placeholder="Superhost desde 2018..."
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
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

        {/* Channel Manager — iCal */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Gestão de canais (iCal)</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Importa disponibilidade do Airbnb, Booking.com e outros canais. As reservas são sincronizadas e bloqueiam datas automaticamente.
          </p>

          {props.map(prop => (
            <div key={prop.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: prop.cor }} />
                <span className="text-sm font-semibold flex-1 truncate">{prop.nome}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      const url = `${origin}/api/ical/${prop.id}`
                      await navigator.clipboard.writeText(url)
                      setSubscribeCopied(s => ({ ...s, [prop.id]: true }))
                      setTimeout(() => setSubscribeCopied(s => ({ ...s, [prop.id]: false })), 2000)
                    }}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${subscribeCopied[prop.id] ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                    title="Copiar URL de subscrição">
                    {subscribeCopied[prop.id] ? <Check className="h-3.5 w-3.5" /> : <Rss className="h-3.5 w-3.5" />}
                    {subscribeCopied[prop.id] ? 'Copiado!' : 'Subscrever'}
                  </button>
                  <button onClick={() => exportIcal(prop)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    .ics
                  </button>
                </div>
              </div>

              {/* Existing feeds */}
              {(prop.ical_feeds ?? []).length > 0 && (
                <div className="divide-y divide-border">
                  {(prop.ical_feeds ?? []).map(feed => {
                    const key = `${prop.id}:${feed.id}`
                    const state = syncStates[key] ?? 'idle'
                    return (
                      <div key={feed.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{feed.nome}</span>
                            {feed.error ? (
                              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            ) : feed.last_sync ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : null}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{feed.url}</p>
                          {feed.last_sync && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {feed.error
                                ? `Erro: ${feed.error}`
                                : `Sincronizado · ${feed.last_count ?? 0} eventos`}
                            </p>
                          )}
                        </div>
                        <button onClick={() => syncFeed(prop, feed)} disabled={state === 'loading'}
                          className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                            state === 'loading' ? 'text-muted-foreground' :
                            state === 'ok' ? 'text-emerald-500' :
                            state === 'error' ? 'text-destructive' :
                            'text-muted-foreground hover:text-primary'
                          }`}>
                          <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => removeFeed(prop, feed.id)}
                          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add new feed */}
              <div className="px-4 py-3 bg-muted/30 flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adicionar canal</p>
                <div className="flex gap-2">
                  <select
                    value={newFeedSource[prop.id] ?? ''}
                    onChange={e => setNewFeedSource(s => ({ ...s, [prop.id]: e.target.value }))}
                    className="rounded-lg border border-input bg-card px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring shrink-0">
                    <option value="">Canal</option>
                    {activeSources.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={newFeedUrl[prop.id] ?? ''}
                    onChange={e => setNewFeedUrl(s => ({ ...s, [prop.id]: e.target.value }))}
                    placeholder="URL do iCal (https://...)"
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-0" />
                  <button onClick={() => addFeed(prop)}
                    disabled={!newFeedUrl[prop.id]?.trim()}
                    className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

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
