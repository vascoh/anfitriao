'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, RefreshCw } from 'lucide-react'
import { db } from '@/lib/db'
import type { Property, PropertyType, IcalFeed, BookingSource } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const ICAL_SOURCES: { value: BookingSource; label: string }[] = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'outro', label: 'Outro' },
]

const PRESET_COLORS = [
  '#C2714F', '#E07B39', '#3D82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316',
]

const AMENITIES = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'ar_condicionado', label: 'Ar condicionado' },
  { id: 'estacionamento', label: 'Estacionamento' },
  { id: 'piscina', label: 'Piscina' },
  { id: 'cozinha', label: 'Cozinha equipada' },
  { id: 'maquina_lavar', label: 'Máquina lavar' },
  { id: 'secador', label: 'Secador' },
  { id: 'tv', label: 'TV' },
  { id: 'varanda', label: 'Varanda' },
  { id: 'jardim', label: 'Jardim' },
]

const TYPES: PropertyType[] = ['apartamento', 'moradia', 'quarto', 'outro']

export default function EditarPropriedadePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PropertyType>('apartamento')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [quartos, setQuartos] = useState(1)
  const [casasBanho, setCasasBanho] = useState(1)
  const [capacidade, setCapacidade] = useState(2)
  const [precoBase, setPrecoBase] = useState(80)
  const [taxaLimpeza, setTaxaLimpeza] = useState(0)
  const [cor, setCor] = useState(PRESET_COLORS[0])
  const [comodidades, setComodidades] = useState<string[]>([])
  const [instrucoesCheckin, setInstrucoesCheckin] = useState('')
  const [regrasCasa, setRegrasCasa] = useState('')
  const [icalFeeds, setIcalFeeds] = useState<IcalFeed[]>([])
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [newFeedSource, setNewFeedSource] = useState<BookingSource>('airbnb')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    db.getProperties().then(all => {
      const p = all.find(x => x.id === id)
      if (!p) { router.push('/propriedades'); return }
      setProp(p)
      setNome(p.nome)
      setTipo(p.tipo)
      setEndereco(p.endereco)
      setCidade(p.cidade)
      setQuartos(p.quartos)
      setCasasBanho(p.casasBanho)
      setCapacidade(p.capacidade)
      setPrecoBase(p.preco_base)
      setTaxaLimpeza(p.taxa_limpeza ?? 0)
      setCor(p.cor)
      setComodidades(p.comodidades)
      setDescricao(p.descricao ?? '')
      setImagemUrl(p.imagem_url ?? '')
      setInstrucoesCheckin(p.instrucoes_checkin)
      setRegrasCasa(p.regras_casa)
      setIcalFeeds(p.ical_feeds ?? [])
    })
  }, [id, router])

  function toggleAmenity(aid: string) {
    setComodidades(prev => prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid])
  }

  function addFeed() {
    if (!newFeedUrl.trim()) return
    const label = ICAL_SOURCES.find(s => s.value === newFeedSource)?.label ?? newFeedSource
    const feed: IcalFeed = {
      id: crypto.randomUUID(),
      url: newFeedUrl.trim(),
      source: newFeedSource,
      nome: label,
    }
    setIcalFeeds(prev => [...prev, feed])
    setNewFeedUrl('')
  }

  function removeFeed(feedId: string) {
    setIcalFeeds(prev => prev.filter(f => f.id !== feedId))
  }

  async function syncNow() {
    if (!prop) return
    setSyncing(true)
    setSyncResult(null)
    try {
      // Save first to persist current feeds
      const updated: Property = {
        ...prop, nome: nome.trim(), tipo, endereco: endereco.trim(), cidade: cidade.trim(),
        descricao: descricao.trim() || undefined, imagem_url: imagemUrl.trim() || undefined,
        quartos, casasBanho, capacidade, preco_base: precoBase, taxa_limpeza: taxaLimpeza || undefined, cor, comodidades,
        instrucoes_checkin: instrucoesCheckin.trim(), regras_casa: regrasCasa.trim(),
        ical_feeds: icalFeeds,
      }
      await db.saveProperty(updated)
      const res = await fetch('/api/ical-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id }),
      })
      const data = await res.json()
      if (data.synced !== undefined) {
        setSyncResult(`${data.synced} reservas importadas`)
        // Reload feeds to get updated last_sync
        const propsAll = await db.getProperties()
        const fresh = propsAll.find(x => x.id === id)
        if (fresh) setIcalFeeds(fresh.ical_feeds ?? [])
      } else {
        setSyncResult(data.error ?? 'Erro desconhecido')
      }
    } catch {
      setSyncResult('Erro de rede')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSave() {
    if (!prop || !nome.trim() || !cidade.trim()) return
    const updated: Property = {
      ...prop,
      nome: nome.trim(),
      tipo,
      endereco: endereco.trim(),
      cidade: cidade.trim(),
      descricao: descricao.trim() || undefined,
      imagem_url: imagemUrl.trim() || undefined,
      quartos,
      casasBanho,
      capacidade,
      preco_base: precoBase,
      taxa_limpeza: taxaLimpeza || undefined,
      cor,
      comodidades,
      instrucoes_checkin: instrucoesCheckin.trim(),
      regras_casa: regrasCasa.trim(),
      ical_feeds: icalFeeds,
    }
    await db.saveProperty(updated)
    router.push(`/propriedades/${id}`)
  }

  if (!prop) return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="h-1 w-full bg-muted" />
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/propriedades/${id}`} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-4 w-36 bg-muted rounded animate-pulse" />
        </div>
      </header>
    </div>
  )

  const canSave = nome.trim() && cidade.trim()

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="h-1 w-full" style={{ backgroundColor: cor }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/propriedades/${id}`} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1 truncate">Editar — {prop.nome}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4 pb-8">
        {/* Basic info */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Informação básica</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    tipo === t ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-card text-foreground/70'
                  }`}>
                  {PROPERTY_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Morada</label>
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Cidade *</label>
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição pública</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Breve descrição para o website de reservas..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Foto principal (URL)</label>
            <input type="url" value={imagemUrl} onChange={e => setImagemUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            {imagemUrl && (
              <img src={imagemUrl} alt="Preview" className="rounded-lg h-32 w-full object-cover mt-1" />
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Capacidade</p>
          {[
            { label: 'Quartos', value: quartos, set: setQuartos, min: 0, max: 20 },
            { label: 'Casas de banho', value: casasBanho, set: setCasasBanho, min: 1, max: 10 },
            { label: 'Máx. hóspedes', value: capacidade, set: setCapacidade, min: 1, max: 30 },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm font-medium">{f.label}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => f.set(Math.max(f.min, f.value - 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  −
                </button>
                <span className="text-sm font-semibold w-5 text-center">{f.value}</span>
                <button onClick={() => f.set(Math.min(f.max, f.value + 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Preço</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Preço base por noite (€)</label>
              <input type="number" value={precoBase} onChange={e => setPrecoBase(Number(e.target.value))} min={1}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Taxa de limpeza (€)</label>
              <input type="number" value={taxaLimpeza} onChange={e => setTaxaLimpeza(Number(e.target.value))} min={0}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cor de identificação</p>
          <div className="flex gap-2.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setCor(c)}
                className={`h-8 w-8 rounded-full transition-transform ${cor === c ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        {/* Amenities */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comodidades</p>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map(a => (
              <button key={a.id} onClick={() => toggleAmenity(a.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  comodidades.includes(a.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground/70 border-input'
                }`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Operacional</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Instruções de check-in</label>
            <textarea value={instrucoesCheckin} onChange={e => setInstrucoesCheckin(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-28 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Regras da casa</label>
            <textarea value={regrasCasa} onChange={e => setRegrasCasa(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-24 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* iCal Sync */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Calendários externos (iCal)</p>
          <p className="text-xs text-muted-foreground -mt-1">Importa reservas do Airbnb, Booking.com e outras plataformas via URL iCal.</p>

          {icalFeeds.map(feed => (
            <div key={feed.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{feed.nome}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{feed.url}</p>
                {feed.last_sync && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Último sync: {new Date(feed.last_sync).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                    {feed.last_count !== undefined && ` · ${feed.last_count} eventos`}
                  </p>
                )}
                {feed.error && <p className="text-[10px] text-destructive mt-1">Erro: {feed.error}</p>}
              </div>
              <button onClick={() => removeFeed(feed.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <select
              value={newFeedSource}
              onChange={e => setNewFeedSource(e.target.value as BookingSource)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ICAL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                type="url"
                value={newFeedUrl}
                onChange={e => setNewFeedUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                className="flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={addFeed}
                disabled={!newFeedUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 active:opacity-80 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </div>

          {icalFeeds.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={syncNow}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'A sincronizar…' : 'Sincronizar agora'}
              </button>
              {syncResult && <span className="text-xs text-muted-foreground">{syncResult}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity">
            Guardar alterações
          </button>
          <Link href={`/propriedades/${id}`}
            className="flex-1 rounded-xl py-3.5 font-semibold text-sm border border-border text-foreground text-center">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
