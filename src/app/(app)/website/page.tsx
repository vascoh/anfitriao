'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Globe, ExternalLink, Copy, Check, ToggleLeft, ToggleRight, ArrowRight, RefreshCw, Download, Plus, Trash2, AlertCircle, CheckCircle2, Rss } from 'lucide-react'
import { fmtMoney, fmtDate, nights, uuid } from '@/lib/utils'
import { fetchProperties, fetchBookings, fetchGuests, fetchSettings } from '@/lib/fetcher'
import { generateIcal } from '@/lib/ical'
import type { WebsiteSettings, Property, IcalFeed } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'
import { WebsitePreview } from '@/components/website-preview'
import { normalizarSlug, validarSlug } from '@/lib/slug'
import { prontidaoDoSite, motivoParaNaoPublicar } from '@/lib/prontidao-site'
import { useUser } from '@clerk/nextjs'

function useOrigin() {
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''))
  return origin
}

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

export default function WebsitePage() {
  const { user } = useUser()
  const ownerId = user?.id
  const origin = useOrigin()
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [props, setProps] = useState<Property[]>([])
  const [allBookings, setAllBookings] = useState<import('@/lib/types').Booking[]>([])
  const [allGuests, setAllGuests] = useState<import('@/lib/types').Guest[]>([])
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  /** Há alterações no formulário que ainda não foram para o servidor. */
  const [porGuardar, setPorGuardar] = useState(false)
  /** Muda a cada gravação para a pré-visualização recarregar o site real. */
  const [versaoPreview, setVersaoPreview] = useState(0)
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const [subscribeCopied, setSubscribeCopied] = useState<Record<string, boolean>>({})
  const [newFeedUrl, setNewFeedUrl] = useState<Record<string, string>>({})
  const [newFeedSource, setNewFeedSource] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!ownerId) return
    fetchSettings().then(s => { if (s) setSettings(s) })
    fetchProperties().then(setProps)
    fetchBookings().then(setAllBookings)
    fetchGuests().then(setAllGuests)
  }, [ownerId])

  const publicUrl = settings?.slug ? `${origin}/r/${settings.slug}` : `${origin}/book`

  /* O que falta para o site valer a pena ser visto. Regra em
   * lib/prontidao-site.ts, para a interface e a API não discordarem. */
  const prontidao = prontidaoDoSite(settings, props)

  function update<K extends keyof WebsiteSettings>(key: K, val: WebsiteSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: val } : prev)
    setSaved(false)
    setPorGuardar(true)
  }

  async function save() {
    if (!settings) return
    /* Mesma regra do servidor (lib/slug.ts): o vazio é ausência de endereço,
     * não uma cadeia vazia — que colidiria no UNIQUE com outra conta. */
    const slug = normalizarSlug(settings.slug)
    const problema = validarSlug(slug)
    if (problema) {
      toast.error(problema)
      return
    }
    if (slug !== settings.slug) update('slug', slug ?? undefined)
    const res = await fetch('/api/website-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...settings, slug }) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erro ao guardar configurações')
      return
    }
    setSaved(true)
    setPorGuardar(false)
    // O site já mudou do lado do servidor: recarregar o que está à direita.
    setVersaoPreview(v => v + 1)
    toast.success('Configurações guardadas')
    setTimeout(() => setSaved(false), 2000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    toast.success('URL copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Sincroniza um feed pela rota do servidor — a mesma que o cron usa.
   *
   * Havia aqui uma segunda implementação, no cliente: lia o feed pelo proxy,
   * criava um hóspede falso por evento (com o texto da plataforma como nome) e
   * guardava o UID dentro das `notas`. A rota do servidor deduplica por
   * `uid_externo`, portanto as duas **não se viam uma à outra**: a mesma
   * reserva entrava duas vezes, a ocupação passava dos 100 % e o calendário
   * mostrava duas reservas nas mesmas datas. Era o problema que a documentação
   * atribui a ligar dois feeds — só que causado por dois caminhos nossos.
   *
   * Uma implementação só, do lado do servidor, é também a única que aplica
   * cancelamentos e alterações de datas (`lib/ical-reconciliacao.ts`).
   */
  async function syncFeed(prop: Property, feed: IcalFeed) {
    const key = `${prop.id}:${feed.id}`
    setSyncStates(s => ({ ...s, [key]: 'loading' }))
    try {
      const res = await fetch('/api/ical-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: prop.id }),
      })
      if (!res.ok) throw new Error('sync falhou')

      const { synced = 0, results = [] } = await res.json() as {
        synced?: number
        results?: Array<{ feed: string; canceladas?: number; atualizadas?: number; error?: string }>
      }
      const falhou = results.find(r => r.error)
      if (falhou) throw new Error(falhou.error)

      const mexidas = results.reduce((s, r) => s + (r.canceladas ?? 0) + (r.atualizadas ?? 0), 0)

      setProps(await fetchProperties())
      setSyncStates(s => ({ ...s, [key]: 'ok' }))
      toast.success(
        synced > 0
          ? `${synced} reserva${synced !== 1 ? 's' : ''} importada${synced !== 1 ? 's' : ''}`
          : mexidas > 0
            ? `Sincronizado — ${mexidas} reserva${mexidas !== 1 ? 's' : ''} atualizada${mexidas !== 1 ? 's' : ''}`
            : 'Sincronizado — sem novidades',
      )
      setTimeout(() => setSyncStates(s => ({ ...s, [key]: 'idle' })), 2000)
    } catch {
      setProps(await fetchProperties())
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
    await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    setProps(await fetchProperties())
    setNewFeedUrl(s => ({ ...s, [prop.id]: '' }))
    setNewFeedSource(s => ({ ...s, [prop.id]: '' }))
  }

  async function removeFeed(prop: Property, feedId: string) {
    const updated: Property = { ...prop, ical_feeds: (prop.ical_feeds ?? []).filter(f => f.id !== feedId) }
    await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    setProps(await fetchProperties())
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

      <div className="flex flex-col gap-8 p-4 lg:flex-row lg:items-start lg:p-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6 lg:max-w-3xl">
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
          <button
            onClick={() => {
              // Despublicar é sempre permitido; publicar exige o essencial.
              if (!settings.enabled && !prontidao.podePublicar) {
                toast.error(motivoParaNaoPublicar(prontidao.emFalta))
                return
              }
              update('enabled', !settings.enabled)
            }}
            className={`shrink-0 transition-colors ${settings.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
            {settings.enabled
              ? <ToggleRight className="h-8 w-8" />
              : <ToggleLeft className="h-8 w-8" />}
          </button>
        </div>

        {/* O que falta — só aparece enquanto houver alguma coisa por fazer */}
        {prontidao.feitos < prontidao.total && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Antes de mostrar isto a hóspedes</p>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {prontidao.feitos}/{prontidao.total}
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {prontidao.itens.map(item => (
                <li key={item.chave} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      item.feito
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : item.essencial
                          ? 'border-amber-500 text-amber-600'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    {item.feito ? '✓' : ''}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm ${item.feito ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                      {item.titulo}
                      {!item.essencial && !item.feito && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          opcional
                        </span>
                      )}
                    </p>
                    {!item.feito && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.ajuda}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {!prontidao.podePublicar && (
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Os três primeiros são precisos para publicar. O resto podes deixar para depois.
              </p>
            )}
          </div>
        )}

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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">URL personalizado</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Slug do website</label>
            <div className="flex items-center rounded-lg border border-input bg-muted/40 overflow-hidden focus-within:ring-2 focus-within:ring-ring">
              <span className="px-3 py-2.5 text-sm text-muted-foreground shrink-0 border-r border-input">{origin}/r/</span>
              <input
                type="text"
                value={settings.slug ?? ''}
                onChange={e => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
                  update('slug', v)
                }}
                placeholder="o-teu-nome"
                className="flex-1 bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none min-w-0"
              />
            </div>
            {settings.slug && settings.slug.length >= 3 ? (
              <p className="text-[11px] text-emerald-600 font-medium">✓ {origin}/r/{settings.slug}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Mínimo 3 caracteres · só letras, números e hífens</p>
            )}
          </div>

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

          {/* ── Identidade dos emails ao hóspede ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Email de reservas (respostas dos hóspedes)</label>
              <input type="email" value={settings.email_reservas ?? ''} onChange={e => update('email_reservas', e.target.value)}
                placeholder="Se vazio, usa o email de contacto"
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Cor principal (site e emails)</label>
              <input type="color" value={settings.cor_primaria ?? '#C2714F'} onChange={e => update('cor_primaria', e.target.value)}
                className="h-[42px] w-full rounded-lg border border-input bg-card px-2 py-1.5 cursor-pointer" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Assinatura dos emails (opcional)</label>
            <textarea value={settings.assinatura_email ?? ''} onChange={e => update('assinatura_email', e.target.value)} rows={2}
              placeholder="Até já! — Vasco, Casa de Vasco"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* ── Aparência do site público ── */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-3">Aparência do site</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Template</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'classico', nome: 'Clássico', desc: 'Hero centrado, cartões arredondados' },
                  { id: 'minimal', nome: 'Minimal', desc: 'Mais compacto, cantos retos' },
                ] as const).map(t => (
                  <button key={t.id} type="button" onClick={() => update('template_id', t.id)}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      (settings.template_id ?? 'classico') === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-input bg-card hover:bg-muted'
                    }`}>
                    <p className="text-sm font-semibold">{t.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Idioma do site</label>
              <select value={settings.idioma ?? 'pt'} onChange={e => update('idioma', e.target.value)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="pt">Português</option>
                <option value="en">English</option>
              </select>
              <p className="text-[11px] text-muted-foreground">Aplica-se ao menu, rodapé e textos fixos do site. O teu texto (descrição, FAQ) mantém-se como escreveste.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Tipo de letra</label>
              <select value={settings.fonte ?? ''} onChange={e => update('fonte', e.target.value || null)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Default (Geist)</option>
                <option value="serif">Elegante (serifada)</option>
                <option value="arredondada">Arredondada (amigável)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium">Perguntas frequentes (site público)</label>
                <button type="button"
                  onClick={() => update('secoes', { ...settings.secoes, faq: [...(settings.secoes?.faq ?? []), { pergunta: '', resposta: '' }] })}
                  className="text-xs text-primary font-semibold flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              {(settings.secoes?.faq ?? []).map((item, i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-input bg-card p-3">
                  <div className="flex items-center gap-2">
                    <input type="text" value={item.pergunta} placeholder="Pergunta"
                      onChange={e => {
                        const faq = [...(settings.secoes?.faq ?? [])]
                        faq[i] = { ...faq[i], pergunta: e.target.value }
                        update('secoes', { ...(settings.secoes ?? {}), faq })
                      }}
                      className="flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    <button type="button" onClick={() => {
                      const faq = (settings.secoes?.faq ?? []).filter((_, j) => j !== i)
                      update('secoes', { ...(settings.secoes ?? {}), faq })
                    }} className="p-2 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea value={item.resposta} placeholder="Resposta" rows={2}
                    onChange={e => {
                      const faq = [...(settings.secoes?.faq ?? [])]
                      faq[i] = { ...faq[i], resposta: e.target.value }
                      update('secoes', { ...(settings.secoes ?? {}), faq })
                    }}
                    className="rounded-md border border-input bg-background px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              ))}
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

        {/* Pré-visualização — o site verdadeiro, não uma imitação dele.
            Sticky no ecrã grande: o formulário rola, o site fica à vista. */}
        <aside className="lg:sticky lg:top-24 lg:w-[460px] xl:w-[520px] shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              O teu site
            </p>
          </div>
          <WebsitePreview
            key={versaoPreview}
            url={publicUrl}
            activo={Boolean(settings.enabled)}
            temSlug={Boolean(settings.slug)}
            porGuardar={porGuardar}
          />
        </aside>
      </div>
    </div>
  )
}
