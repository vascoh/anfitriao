'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Tag, Plus, Trash2, Edit2, ChevronLeft, ChevronRight,
  Globe, Percent, Euro, Calendar, Check, X,
  TrendingUp, TrendingDown, BarChart3, Settings2, RefreshCw,
} from 'lucide-react'
import { db } from '@/lib/db'
import { getPriceForDay } from '@/lib/reservations'
import { fmtMoney, uuid } from '@/lib/utils'
import type {
  Property, PriceRule, PriceRuleTipo, Tarifa, TarifaTipo,
  PlatformRate, BookingSource,
} from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'
import { useUser } from '@clerk/nextjs'

// ─── label maps ────────────────────────────────────────────────────────────────

const RULE_TIPO_LABEL: Record<PriceRuleTipo, string> = {
  custom:    'Personalizada',
  seasonal:  'Sazonal',
  weekend:   'Fim de semana',
  holiday:   'Feriado',
  promo:     'Promoção',
  long_stay: 'Longa estadia',
}

const RULE_TIPO_COLOR: Record<PriceRuleTipo, string> = {
  custom:    'bg-gray-100 text-gray-700',
  seasonal:  'bg-blue-50 text-blue-700',
  weekend:   'bg-purple-50 text-purple-700',
  holiday:   'bg-amber-50 text-amber-700',
  promo:     'bg-emerald-50 text-emerald-700',
  long_stay: 'bg-cyan-50 text-cyan-700',
}

const TARIFA_TIPO_LABEL: Record<TarifaTipo, string> = {
  standard:      'Standard',
  non_refundable:'Não reembolsável',
  breakfast:     'Pequeno-almoço incl.',
  long_stay:     'Longa estadia',
  promo:         'Promocional',
  corporate:     'Corporate',
  ota:           'OTA específica',
  seasonal:      'Sazonal',
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const PLATAFORMAS: BookingSource[] = ['airbnb', 'booking', 'expedia', 'vrbo', 'direto', 'outro']

// ─── types ─────────────────────────────────────────────────────────────────────

type Tab = 'visao' | 'calendario' | 'regras' | 'tarifas' | 'plataformas' | 'massa'

// ─── main page ─────────────────────────────────────────────────────────────────

export default function PrecosPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [tab, setTab] = useState<Tab>('visao')
  const [props, setProps] = useState<Property[]>([])
  const [rules, setRules] = useState<PriceRule[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [platforms, setPlatforms] = useState<PlatformRate[]>([])
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg: string, ok = true) => {
    if (ok) toast.success(msg)
    else toast.error(msg)
  }, [])

  async function reload() {
    setLoading(true)
    const [p, r, t, pl] = await Promise.all([
      db.getProperties(ownerId),
      db.getPriceRules(),
      db.getTarifas(),
      db.getPlatformRates(),
    ])
    setProps(p)
    setRules(r)
    setTarifas(t)
    setPlatforms(pl)
    setLoading(false)
  }

  useEffect(() => {
    if (!ownerId) return
    const t = setTimeout(() => { reload() }, 0)
    return () => clearTimeout(t)
  }, [ownerId])

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'visao',       label: 'Visão geral',  icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: 'calendario',  label: 'Calendário',   icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'regras',      label: 'Regras',        icon: <Tag className="h-3.5 w-3.5" /> },
    { key: 'tarifas',     label: 'Tarifas',       icon: <Settings2 className="h-3.5 w-3.5" /> },
    { key: 'plataformas', label: 'Plataformas',   icon: <Globe className="h-3.5 w-3.5" /> },
    { key: 'massa',       label: 'Atualiz. massa',icon: <RefreshCw className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Preços</h1>
          {loading && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-4 lg:px-8 overflow-x-auto no-scrollbar border-t border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {tab === 'visao'       && <TabVisao props={props} rules={rules} platforms={platforms} onReload={reload} showToast={showToast} />}
        {tab === 'calendario'  && <TabCalendario props={props} rules={rules} />}
        {tab === 'regras'      && <TabRegras props={props} rules={rules} onReload={reload} showToast={showToast} />}
        {tab === 'tarifas'     && <TabTarifas props={props} tarifas={tarifas} onReload={reload} showToast={showToast} />}
        {tab === 'plataformas' && <TabPlataformas props={props} platforms={platforms} onReload={reload} showToast={showToast} />}
        {tab === 'massa'       && <TabMassa props={props} rules={rules} onReload={reload} showToast={showToast} />}
      </div>

    </div>
  )
}

// ─── Tab: Visão Geral ──────────────────────────────────────────────────────────

function TabVisao({
  props, rules, platforms, onReload, showToast,
}: {
  props: Property[]; rules: PriceRule[]; platforms: PlatformRate[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [newPreco, setNewPreco] = useState('')
  const [newLimpeza, setNewLimpeza] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(p: Property) {
    setEditing(p.id)
    setNewPreco(String(p.preco_base))
    setNewLimpeza(String(p.taxa_limpeza ?? 0))
  }

  async function save(p: Property) {
    setSaving(true)
    const prev = { preco_base: p.preco_base, taxa_limpeza: p.taxa_limpeza }
    const updated: Property = {
      ...p,
      preco_base: parseFloat(newPreco) || 0,
      taxa_limpeza: parseFloat(newLimpeza) || 0,
    }
    try {
      await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      fetch('/api/price-change-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: p.id, tipo: 'base_price_changed', descricao: `Preço base alterado de €${p.preco_base} para €${updated.preco_base}`, dadosAnteriores: prev, dadosNovos: { preco_base: updated.preco_base, taxa_limpeza: updated.taxa_limpeza } }) }).catch(() => {})
      showToast('Preço atualizado')
      onReload()
    } catch {
      showToast('Erro ao guardar', false)
    }
    setSaving(false)
    setEditing(null)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <p className="text-sm text-muted-foreground">Preços base de cada propriedade. Ajusta rapidamente ou usa as outras abas para regras avançadas.</p>

      {props.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">Sem propriedades. Adiciona uma propriedade primeiro.</div>
      )}

      {props.map(p => {
        const propRules = rules.filter(r => r.property_id === p.id && r.ativo)
        const todayPrice = getPriceForDay(p, today, propRules)
        const propPlatforms = platforms.filter(pl => pl.property_id === p.id && pl.ativo)
        const isEdit = editing === p.id

        return (
          <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="h-1" style={{ backgroundColor: p.cor }} />
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-base">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.cidade}</p>
                </div>
                {!isEdit && (
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {isEdit ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground font-medium">Preço/noite (€)</label>
                      <input
                        type="number" min={0} step={1} value={newPreco}
                        onChange={e => setNewPreco(e.target.value)}
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground font-medium">Taxa limpeza (€)</label>
                      <input
                        type="number" min={0} step={1} value={newLimpeza}
                        onChange={e => setNewLimpeza(e.target.value)}
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => save(p)} disabled={saving}
                      className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold disabled:opacity-40">
                      {saving ? 'A guardar...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="px-4 border border-border rounded-lg text-sm text-muted-foreground">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Preço base</p>
                    <p className="text-base font-bold">{fmtMoney(p.preco_base)}</p>
                    <p className="text-[10px] text-muted-foreground">por noite</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Hoje</p>
                    <p className="text-base font-bold" style={{ color: todayPrice.regra ? 'var(--primary)' : undefined }}>
                      {fmtMoney(todayPrice.preco)}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{todayPrice.regra ?? 'sem regra'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Limpeza</p>
                    <p className="text-base font-bold">{fmtMoney(p.taxa_limpeza ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">por estadia</p>
                  </div>
                </div>
              )}

              {/* Platform rates summary */}
              {propPlatforms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {propPlatforms.map(pl => {
                    const diff = pl.multiplicador - 1
                    return (
                      <span key={pl.plataforma} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                        {SOURCE_LABEL[pl.plataforma]}
                        {diff > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : diff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                        {diff !== 0 ? `${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%` : 'Base'}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Active rules count */}
              {propRules.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {propRules.length} regra{propRules.length !== 1 ? 's' : ''} ativa{propRules.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Calendário de Preços ─────────────────────────────────────────────────

function TabCalendario({ props, rules }: { props: Property[]; rules: PriceRule[] }) {
  const [selectedProp, setSelectedProp] = useState<string | null>(null)
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-based

  const prop = props.find(p => p.id === selectedProp) ?? props[0]

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const calDays = useMemo(() => {
    if (!prop) return []
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    const startPad = firstDay.getDay() // 0=Sun
    const days: { date: string; preco: number; regra?: string; isCurrentMonth: boolean }[] = []

    // Padding from previous month
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i)
      const date = d.toISOString().slice(0, 10)
      const { preco, regra } = getPriceForDay(prop, date, rules.filter(r => r.property_id === prop.id && r.ativo))
      days.push({ date, preco, regra, isCurrentMonth: false })
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const { preco, regra } = getPriceForDay(prop, date, rules.filter(r => r.property_id === prop.id && r.ativo))
      days.push({ date, preco, regra, isCurrentMonth: true })
    }

    // Pad to complete last week
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i)
        const date = d.toISOString().slice(0, 10)
        const { preco, regra } = getPriceForDay(prop, date, rules.filter(r => r.property_id === prop.id && r.ativo))
        days.push({ date, preco, regra, isCurrentMonth: false })
      }
    }
    return days
  }, [prop, rules, viewYear, viewMonth])

  const priceMin = useMemo(() => Math.min(...calDays.filter(d => d.isCurrentMonth).map(d => d.preco)), [calDays])
  const priceMax = useMemo(() => Math.max(...calDays.filter(d => d.isCurrentMonth).map(d => d.preco)), [calDays])

  function priceColor(preco: number, isCurrentMonth: boolean): string {
    if (!isCurrentMonth) return 'text-muted-foreground/30'
    if (priceMax === priceMin) return 'text-foreground'
    const ratio = (preco - priceMin) / (priceMax - priceMin)
    if (ratio > 0.66) return 'text-emerald-600 font-semibold'
    if (ratio > 0.33) return 'text-amber-600'
    return 'text-muted-foreground'
  }

  const today = new Date().toISOString().slice(0, 10)
  const monthLabel = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1))

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      {/* Property selector */}
      {props.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {props.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProp(p.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (selectedProp ?? props[0]?.id) === p.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
              style={(selectedProp ?? props[0]?.id) === p.id ? { backgroundColor: p.cor } : {}}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {!prop && (
        <div className="text-center py-16 text-muted-foreground text-sm">Sem propriedades configuradas.</div>
      )}

      {prop && (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold capitalize">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Preço alto</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Médio</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Baixo</span>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => (
              <div key={d} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {calDays.map(({ date, preco, regra, isCurrentMonth }) => {
              const isToday = date === today
              return (
                <div
                  key={date}
                  title={regra ? `${fmtMoney(preco)} – ${regra}` : fmtMoney(preco)}
                  className={`flex flex-col items-center justify-center gap-0.5 p-1.5 min-h-[52px] text-center transition-colors
                    ${isCurrentMonth ? 'bg-card hover:bg-muted/30' : 'bg-muted/10'}
                    ${isToday ? 'ring-1 ring-primary ring-inset' : ''}`}
                >
                  <span className={`text-[10px] font-medium ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'} ${isToday ? 'text-primary font-bold' : ''}`}>
                    {parseInt(date.slice(8))}
                  </span>
                  {isCurrentMonth && (
                    <span className={`text-[10px] leading-tight ${priceColor(preco, isCurrentMonth)}`}>
                      €{preco}
                    </span>
                  )}
                  {regra && isCurrentMonth && (
                    <span className="h-1 w-1 rounded-full bg-primary" title={regra} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Mín. mês</p>
              <p className="text-sm font-bold">{fmtMoney(priceMin)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Méd. mês</p>
              <p className="text-sm font-bold">{fmtMoney(Math.round((priceMin + priceMax) / 2))}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Máx. mês</p>
              <p className="text-sm font-bold">{fmtMoney(priceMax)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Price Rule Form ───────────────────────────────────────────────────────────

function RuleForm({
  props,
  initial,
  onSave,
  onCancel,
}: {
  props: Property[];
  initial?: PriceRule;
  onSave: (r: PriceRule) => void;
  onCancel: () => void;
}) {
  const [propertyId, setPropertyId] = useState(initial?.property_id ?? props[0]?.id ?? '')
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [tipo, setTipo] = useState<PriceRuleTipo>(initial?.tipo ?? 'custom')
  const [dataInicio, setDataInicio] = useState(initial?.data_inicio ?? '')
  const [dataFim, setDataFim] = useState(initial?.data_fim ?? '')
  const [diasSemana, setDiasSemana] = useState<number[]>(initial?.dias_semana ?? [])
  const [precoNoite, setPrecoNoite] = useState(initial?.preco_noite != null ? String(initial.preco_noite) : '')
  const [taxaLimpeza, setTaxaLimpeza] = useState(initial?.taxa_limpeza != null ? String(initial.taxa_limpeza) : '')
  const [descontoPct, setDescontoPct] = useState(initial?.desconto_pct != null ? String(initial.desconto_pct) : '')
  const [minNoites, setMinNoites] = useState(initial?.min_noites != null ? String(initial.min_noites) : '')
  const [maxNoites, setMaxNoites] = useState(initial?.max_noites != null ? String(initial.max_noites) : '')
  const [prioridade, setPrioridade] = useState(String(initial?.prioridade ?? 0))
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)

  function toggleDia(d: number) {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    const rule: PriceRule = {
      id: initial?.id ?? uuid(),
      property_id: propertyId,
      nome: nome.trim() || 'Sem nome',
      tipo,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      dias_semana: diasSemana.length > 0 ? diasSemana : undefined,
      preco_noite: precoNoite !== '' ? parseFloat(precoNoite) : undefined,
      taxa_limpeza: taxaLimpeza !== '' ? parseFloat(taxaLimpeza) : undefined,
      desconto_pct: descontoPct !== '' ? parseFloat(descontoPct) : undefined,
      min_noites: minNoites !== '' ? parseInt(minNoites) : undefined,
      max_noites: maxNoites !== '' ? parseInt(maxNoites) : undefined,
      prioridade: parseInt(prioridade) || 0,
      ativo,
      criado_em: initial?.criado_em ?? new Date().toISOString(),
    }
    onSave(rule)
  }

  const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const labelCls = 'text-xs text-muted-foreground font-medium'

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{initial ? 'Editar regra' : 'Nova regra de preço'}</p>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {props.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Propriedade</label>
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={inputCls}>
            {props.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nome</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Verão 2025" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as PriceRuleTipo)} className={inputCls}>
            {Object.entries(RULE_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Data início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Data fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Dias da semana (vazio = todos)</label>
        <div className="flex gap-1.5 flex-wrap">
          {DIAS_SEMANA.map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDia(i)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                diasSemana.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Preço/noite (€)</label>
          <input type="number" min={0} value={precoNoite} onChange={e => setPrecoNoite(e.target.value)} placeholder="= base" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Limpeza (€)</label>
          <input type="number" min={0} value={taxaLimpeza} onChange={e => setTaxaLimpeza(e.target.value)} placeholder="= prop." className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Ajuste % (+/-)</label>
          <input type="number" value={descontoPct} onChange={e => setDescontoPct(e.target.value)} placeholder="Ex: -10 ou +20" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Mín. noites</label>
          <input type="number" min={1} value={minNoites} onChange={e => setMinNoites(e.target.value)} placeholder="Nenhum" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Máx. noites</label>
          <input type="number" min={1} value={maxNoites} onChange={e => setMaxNoites(e.target.value)} placeholder="Nenhum" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Prioridade</label>
          <input type="number" value={prioridade} onChange={e => setPrioridade(e.target.value)} placeholder="0" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setAtivo(!ativo)}
          className={`relative h-5 w-9 rounded-full transition-colors ${ativo ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-muted-foreground">{ativo ? 'Ativa' : 'Inativa'}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold">
          {initial ? 'Guardar alterações' : 'Criar regra'}
        </button>
        <button onClick={onCancel} className="px-4 border border-border rounded-lg text-sm text-muted-foreground">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Regras ───────────────────────────────────────────────────────────────

function TabRegras({
  props, rules, onReload, showToast,
}: {
  props: Property[]; rules: PriceRule[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [showForm, setShowForm] = useState(false)
  const [editRule, setEditRule] = useState<PriceRule | null>(null)
  const [filterProp, setFilterProp] = useState<string | null>(null)

  const filtered = filterProp ? rules.filter(r => r.property_id === filterProp) : rules

  async function handleSave(r: PriceRule) {
    try {
      await fetch('/api/price-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
      showToast('Regra guardada')
      onReload()
    } catch {
      showToast('Erro ao guardar', false)
    }
    setShowForm(false)
    setEditRule(null)
  }

  async function handleDelete(r: PriceRule) {
    try {
      await fetch(`/api/price-rules?id=${r.id}`, { method: 'DELETE' })
      showToast('Regra eliminada')
      onReload()
    } catch {
      showToast('Erro ao eliminar', false)
    }
  }

  async function toggleActive(r: PriceRule) {
    try {
      await fetch('/api/price-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, ativo: !r.ativo }) })
      showToast(r.ativo ? 'Regra desativada' : 'Regra ativada')
      onReload()
    } catch {
      showToast('Erro', false)
    }
  }

  function propName(id: string) { return props.find(p => p.id === id)?.nome ?? '—' }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Regras sobrepõem o preço base da propriedade por datas ou dias da semana.</p>
        <button onClick={() => { setEditRule(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium">
          <Plus className="h-3.5 w-3.5" /> Nova
        </button>
      </div>

      {/* Property filter */}
      {props.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setFilterProp(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterProp ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            Todas
          </button>
          {props.map(p => (
            <button key={p.id} onClick={() => setFilterProp(filterProp === p.id ? null : p.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterProp === p.id ? 'text-white' : 'bg-muted text-muted-foreground'}`}
              style={filterProp === p.id ? { backgroundColor: p.cor } : {}}>
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {(showForm || editRule) && (
        <RuleForm
          props={props}
          initial={editRule ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditRule(null) }}
        />
      )}

      {filtered.length === 0 && !showForm && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Sem regras. Cria uma regra para definir preços especiais por época, fim de semana ou promoção.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(r => {
          const prop = props.find(p => p.id === r.property_id)
          return (
            <div key={r.id} className={`rounded-xl border bg-card overflow-hidden ${r.ativo ? 'border-border' : 'border-border/40 opacity-60'}`}>
              <div className="h-0.5 w-full" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{r.nome}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RULE_TIPO_COLOR[r.tipo]}`}>
                        {RULE_TIPO_LABEL[r.tipo]}
                      </span>
                    </div>
                    {props.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{propName(r.property_id)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(r)}
                      className={`relative h-4 w-7 rounded-full transition-colors ${r.ativo ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${r.ativo ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => { setEditRule(r); setShowForm(false) }}
                      className="p-1 text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r)}
                      className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Rule details */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(r.data_inicio || r.data_fim) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {r.data_inicio ?? '∞'} → {r.data_fim ?? '∞'}
                    </span>
                  )}
                  {r.dias_semana && r.dias_semana.length > 0 && (
                    <span>{r.dias_semana.map(d => DIAS_SEMANA[d]).join(', ')}</span>
                  )}
                  {r.preco_noite != null && (
                    <span className="flex items-center gap-0.5"><Euro className="h-3 w-3" />{r.preco_noite}/noite</span>
                  )}
                  {r.desconto_pct != null && r.desconto_pct !== 0 && (
                    <span className={`flex items-center gap-0.5 font-medium ${r.desconto_pct > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      <Percent className="h-3 w-3" />
                      {r.desconto_pct > 0 ? '+' : ''}{r.desconto_pct}%
                    </span>
                  )}
                  {r.min_noites && <span>Mín. {r.min_noites}n</span>}
                  {r.max_noites && <span>Máx. {r.max_noites}n</span>}
                  {r.taxa_limpeza != null && <span>Limpeza: €{r.taxa_limpeza}</span>}
                  <span className="text-muted-foreground/60">Prio. {r.prioridade}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Tarifas ──────────────────────────────────────────────────────────────

function TarifaForm({
  props, initial, onSave, onCancel,
}: {
  props: Property[]; initial?: Tarifa;
  onSave: (t: Tarifa) => void; onCancel: () => void;
}) {
  const [propertyId, setPropertyId] = useState(initial?.property_id ?? props[0]?.id ?? '')
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [tipo, setTipo] = useState<TarifaTipo>(initial?.tipo ?? 'standard')
  const [descontoPct, setDescontoPct] = useState(String(initial?.desconto_pct ?? 0))
  const [suplemento, setSuplemento] = useState(String(initial?.suplemento_valor ?? 0))
  const [minNoites, setMinNoites] = useState(String(initial?.min_noites ?? 1))
  const [maxNoites, setMaxNoites] = useState(initial?.max_noites != null ? String(initial.max_noites) : '')
  const [cancelHoras, setCancelHoras] = useState(initial?.cancelamento_horas != null ? String(initial.cancelamento_horas) : '')
  const [politica, setPolitica] = useState(initial?.politica_cancelamento ?? '')
  const [selectedPlats, setSelectedPlats] = useState<BookingSource[]>(initial?.plataformas ?? [])
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)

  function togglePlat(p: BookingSource) {
    setSelectedPlats(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function handleSave() {
    const t: Tarifa = {
      id: initial?.id ?? uuid(),
      property_id: propertyId,
      nome: nome.trim() || 'Sem nome',
      tipo,
      desconto_pct: parseFloat(descontoPct) || 0,
      suplemento_valor: parseFloat(suplemento) || 0,
      min_noites: parseInt(minNoites) || 1,
      max_noites: maxNoites !== '' ? parseInt(maxNoites) : undefined,
      cancelamento_horas: cancelHoras !== '' ? parseInt(cancelHoras) : undefined,
      politica_cancelamento: politica.trim() || undefined,
      plataformas: selectedPlats.length > 0 ? selectedPlats : undefined,
      ativo,
      criado_em: initial?.criado_em ?? new Date().toISOString(),
    }
    onSave(t)
  }

  const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const labelCls = 'text-xs text-muted-foreground font-medium'

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{initial ? 'Editar tarifa' : 'Nova tarifa'}</p>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {props.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Propriedade</label>
          <select value={propertyId} onChange={e => setPropertyId(e.target.value)} className={inputCls}>
            {props.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Nome</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Não reembolsável" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TarifaTipo)} className={inputCls}>
            {Object.entries(TARIFA_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Desconto/Suplemento %</label>
          <input type="number" value={descontoPct} onChange={e => setDescontoPct(e.target.value)} placeholder="-10 ou +5" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Suplemento fixo (€)</label>
          <input type="number" min={0} value={suplemento} onChange={e => setSuplemento(e.target.value)} placeholder="0" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Mín. noites</label>
          <input type="number" min={1} value={minNoites} onChange={e => setMinNoites(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Máx. noites</label>
          <input type="number" min={1} value={maxNoites} onChange={e => setMaxNoites(e.target.value)} placeholder="Sem limite" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Cancelamento gratuito (horas)</label>
          <input type="number" min={0} value={cancelHoras} onChange={e => setCancelHoras(e.target.value)} placeholder="Ex: 48" className={inputCls} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls}>Política de cancelamento</label>
        <textarea value={politica} onChange={e => setPolitica(e.target.value)} placeholder="Descreve a política..." rows={2}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Plataformas (vazio = todas)</label>
        <div className="flex gap-1.5 flex-wrap">
          {PLATAFORMAS.map(p => (
            <button key={p} onClick={() => togglePlat(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedPlats.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
              {SOURCE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setAtivo(!ativo)}
          className={`relative h-5 w-9 rounded-full transition-colors ${ativo ? 'bg-primary' : 'bg-muted'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-muted-foreground">{ativo ? 'Ativa' : 'Inativa'}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold">
          {initial ? 'Guardar' : 'Criar tarifa'}
        </button>
        <button onClick={onCancel} className="px-4 border border-border rounded-lg text-sm text-muted-foreground">Cancelar</button>
      </div>
    </div>
  )
}

function TabTarifas({
  props, tarifas, onReload, showToast,
}: {
  props: Property[]; tarifas: Tarifa[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [showForm, setShowForm] = useState(false)
  const [editTarifa, setEditTarifa] = useState<Tarifa | null>(null)
  const [filterProp, setFilterProp] = useState<string | null>(null)

  const filtered = filterProp ? tarifas.filter(t => t.property_id === filterProp) : tarifas

  async function handleSave(t: Tarifa) {
    try {
      await fetch('/api/tarifas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
      showToast('Tarifa guardada')
      onReload()
    } catch { showToast('Erro ao guardar', false) }
    setShowForm(false); setEditTarifa(null)
  }

  async function handleDelete(t: Tarifa) {
    try {
      await fetch(`/api/tarifas?id=${t.id}`, { method: 'DELETE' })
      showToast('Tarifa eliminada')
      onReload()
    } catch { showToast('Erro ao eliminar', false) }
  }

  async function toggleActive(t: Tarifa) {
    try {
      await fetch('/api/tarifas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, ativo: !t.ativo }) })
      showToast(t.ativo ? 'Tarifa desativada' : 'Tarifa ativada')
      onReload()
    } catch { showToast('Erro', false) }
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Tarifas com políticas de cancelamento, suplementos e restrições por plataforma.</p>
        <button onClick={() => { setEditTarifa(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium">
          <Plus className="h-3.5 w-3.5" /> Nova
        </button>
      </div>

      {props.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setFilterProp(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${!filterProp ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            Todas
          </button>
          {props.map(p => (
            <button key={p.id} onClick={() => setFilterProp(filterProp === p.id ? null : p.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${filterProp === p.id ? 'text-white' : 'bg-muted text-muted-foreground'}`}
              style={filterProp === p.id ? { backgroundColor: p.cor } : {}}>
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {(showForm || editTarifa) && (
        <TarifaForm
          props={props} initial={editTarifa ?? undefined}
          onSave={handleSave} onCancel={() => { setShowForm(false); setEditTarifa(null) }}
        />
      )}

      {filtered.length === 0 && !showForm && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Sem tarifas. Cria uma tarifa para definir políticas de preço diferenciadas.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(t => {
          const prop = props.find(p => p.id === t.property_id)
          return (
            <div key={t.id} className={`rounded-xl border bg-card overflow-hidden ${t.ativo ? 'border-border' : 'border-border/40 opacity-60'}`}>
              <div className="h-0.5 w-full" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{t.nome}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {TARIFA_TIPO_LABEL[t.tipo]}
                      </span>
                    </div>
                    {props.length > 1 && (
                      <p className="text-xs text-muted-foreground">{prop?.nome}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(t)}
                      className={`relative h-4 w-7 rounded-full transition-colors ${t.ativo ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${t.ativo ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => { setEditTarifa(t); setShowForm(false) }}
                      className="p-1 text-muted-foreground hover:text-foreground">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(t)}
                      className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {t.desconto_pct !== 0 && (
                    <span className={`font-medium ${t.desconto_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {t.desconto_pct > 0 ? '+' : ''}{t.desconto_pct}%
                    </span>
                  )}
                  {t.suplemento_valor > 0 && <span>+€{t.suplemento_valor} suplemento</span>}
                  <span>Mín. {t.min_noites}n{t.max_noites ? ` · Máx. ${t.max_noites}n` : ''}</span>
                  {t.cancelamento_horas != null && <span>Cancel. grátis até {t.cancelamento_horas}h</span>}
                  {t.plataformas && t.plataformas.length > 0 && (
                    <span>{t.plataformas.map(p => SOURCE_LABEL[p]).join(', ')}</span>
                  )}
                </div>
                {t.politica_cancelamento && (
                  <p className="text-xs text-muted-foreground/80 leading-snug">{t.politica_cancelamento}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Plataformas ──────────────────────────────────────────────────────────

function TabPlataformas({
  props, platforms, onReload, showToast,
}: {
  props: Property[]; platforms: PlatformRate[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [localRates, setLocalRates] = useState<Record<string, { mult: string; comissao: string; ativo: boolean }>>({})

  // Initialize local state from loaded data
  useEffect(() => {
    const t = setTimeout(() => {
      const init: typeof localRates = {}
      props.forEach(prop => {
        PLATAFORMAS.forEach(plat => {
          const key = `${prop.id}:${plat}`
          const existing = platforms.find(r => r.property_id === prop.id && r.plataforma === plat)
          init[key] = {
            mult: existing ? String(((existing.multiplicador - 1) * 100).toFixed(1)) : '0',
            comissao: existing ? String(existing.comissao_pct) : '0',
            ativo: existing?.ativo ?? true,
          }
        })
      })
      setLocalRates(init)
    }, 0)
    return () => clearTimeout(t)
  }, [platforms, props])

  async function saveRate(prop: Property, plat: BookingSource) {
    const key = `${prop.id}:${plat}`
    const local = localRates[key]
    if (!local) return
    setSaving(key)
    const existing = platforms.find(r => r.property_id === prop.id && r.plataforma === plat)
    const rate: PlatformRate = {
      id: existing?.id ?? uuid(),
      property_id: prop.id,
      plataforma: plat,
      multiplicador: 1 + (parseFloat(local.mult) || 0) / 100,
      comissao_pct: parseFloat(local.comissao) || 0,
      ativo: local.ativo,
      criado_em: existing?.criado_em ?? new Date().toISOString(),
    }
    try {
      await fetch('/api/platform-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rate) })
      showToast(`${SOURCE_LABEL[plat]} atualizado`)
      onReload()
    } catch { showToast('Erro ao guardar', false) }
    setSaving(null)
  }

  function updateLocal(propId: string, plat: BookingSource, field: 'mult' | 'comissao' | 'ativo', value: string | boolean) {
    const key = `${propId}:${plat}`
    setLocalRates(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8">
      <p className="text-sm text-muted-foreground">
        Define margens por plataforma. Ex: Booking.com com +15% cobre a comissão e mantém a mesma margem do direto.
      </p>

      {props.map(prop => (
        <div key={prop.id} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: prop.cor }} />
          <div className="p-4 flex flex-col gap-3">
            <p className="font-semibold text-sm">{prop.nome}</p>

            <div className="flex flex-col gap-2">
              {PLATAFORMAS.map(plat => {
                const key = `${prop.id}:${plat}`
                const local = localRates[key]
                if (!local) return null
                const mult = parseFloat(local.mult) || 0
                const isSaving = saving === key

                return (
                  <div key={plat} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-medium">{SOURCE_LABEL[plat]}</p>
                      {local.comissao !== '0' && parseFloat(local.comissao) > 0 && (
                        <p className="text-[10px] text-muted-foreground">comissão: {local.comissao}%</p>
                      )}
                    </div>

                    {/* Multiplier input */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs text-muted-foreground shrink-0">Margem</span>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step={0.5}
                          value={local.mult}
                          onChange={e => updateLocal(prop.id, plat, 'mult', e.target.value)}
                          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="absolute right-2 text-xs text-muted-foreground">%</span>
                      </div>
                      <span className={`text-xs font-medium ${mult > 0 ? 'text-emerald-600' : mult < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {mult > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : mult < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                      </span>
                    </div>

                    {/* Comissão */}
                    <div className="flex items-center gap-1.5 w-20 shrink-0">
                      <span className="text-xs text-muted-foreground shrink-0">Com.</span>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step={0.5}
                          min={0}
                          value={local.comissao}
                          onChange={e => updateLocal(prop.id, plat, 'comissao', e.target.value)}
                          className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="absolute right-1 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => saveRate(prop, plat)}
                      disabled={isSaving}
                      className="shrink-0 bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
                    >
                      {isSaving ? '...' : 'OK'}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Preview table */}
            <div className="mt-1 rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preço final por plataforma (base {fmtMoney(prop.preco_base)}/noite)</p>
              <div className="grid grid-cols-3 gap-2">
                {PLATAFORMAS.filter(plat => {
                  const local = localRates[`${prop.id}:${plat}`]
                  return local && (parseFloat(local.mult) !== 0 || plat === 'direto')
                }).slice(0, 6).map(plat => {
                  const local = localRates[`${prop.id}:${plat}`]
                  if (!local) return null
                  const mult = parseFloat(local.mult) || 0
                  const precoFinal = Math.round(prop.preco_base * (1 + mult / 100))
                  return (
                    <div key={plat} className="text-center">
                      <p className="text-[10px] text-muted-foreground">{SOURCE_LABEL[plat]}</p>
                      <p className="text-sm font-bold">{fmtMoney(precoFinal)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Atualização em Massa ─────────────────────────────────────────────────

function TabMassa({
  props, rules, onReload, showToast,
}: {
  props: Property[]; rules: PriceRule[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [selectedProps, setSelectedProps] = useState<string[]>([])
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [operacao, setOperacao] = useState<'pct' | 'fixo' | 'novo'>('pct')
  const [valor, setValor] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PriceRuleTipo>('seasonal')
  const [preview, setPreview] = useState<{ prop: string; antes: number; depois: number }[]>([])
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  function toggleProp(id: string) {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleDia(d: number) {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function generatePreview() {
    if (selectedProps.length === 0) return
    const v = parseFloat(valor) || 0
    const p = selectedProps.map(pid => {
      const prop = props.find(p => p.id === pid)!
      const antes = prop.preco_base
      let depois = antes
      if (operacao === 'pct') depois = Math.round(antes * (1 + v / 100))
      else if (operacao === 'fixo') depois = Math.round(antes + v)
      else if (operacao === 'novo') depois = Math.round(v)
      return { prop: prop.nome, antes, depois }
    })
    setPreview(p)
  }

  useEffect(() => {
    if (selectedProps.length > 0 && valor !== '') {
      const t = setTimeout(() => generatePreview(), 0)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setPreview([]), 0)
      return () => clearTimeout(t)
    }
  }, [selectedProps, valor, operacao])

  async function applyMassa() {
    if (selectedProps.length === 0 || !nome.trim()) return
    setApplying(true)
    const v = parseFloat(valor) || 0
    try {
      for (const pid of selectedProps) {
        const rule: PriceRule = {
          id: uuid(),
          property_id: pid,
          nome: nome.trim(),
          tipo,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          dias_semana: diasSemana.length > 0 ? diasSemana : undefined,
          preco_noite: operacao === 'novo' ? v : undefined,
          desconto_pct: operacao === 'pct' ? v : operacao === 'fixo' ? undefined : undefined,
          prioridade: 10,
          ativo: true,
          criado_em: new Date().toISOString(),
        }
        // For 'fixo' mode, we compute the actual price difference
        if (operacao === 'fixo') {
          const prop = props.find(p => p.id === pid)!
          rule.preco_noite = prop.preco_base + v
        }
        await fetch('/api/price-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) })
        fetch('/api/price-change-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: pid, tipo: 'bulk_update', descricao: `Atualização em massa: ${nome.trim()}`, dadosNovos: { rule } }) }).catch(() => {})
      }
      showToast(`${selectedProps.length} propriedade(s) atualizadas`)
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
      onReload()
    } catch {
      showToast('Erro na atualização', false)
    }
    setApplying(false)
  }

  const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const labelCls = 'text-xs text-muted-foreground font-medium'

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-8">
      <p className="text-sm text-muted-foreground">
        Cria uma regra de preço em massa para várias propriedades de uma vez. Útil para épocas, feriados e promoções.
      </p>

      {/* Step 1: Select properties */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">1. Selecionar propriedades</label>
          <button
            onClick={() => setSelectedProps(selectedProps.length === props.length ? [] : props.map(p => p.id))}
            className="text-xs text-primary font-medium"
          >
            {selectedProps.length === props.length ? 'Desselecionar todas' : 'Selecionar todas'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {props.map(p => (
            <button key={p.id} onClick={() => toggleProp(p.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedProps.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}>
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
              <span className="flex-1 text-sm font-medium">{p.nome}</span>
              <span className="text-xs text-muted-foreground">{fmtMoney(p.preco_base)}/noite</span>
              {selectedProps.includes(p.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Dates */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">2. Período (opcional)</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Data início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Data fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Dias da semana (vazio = todos)</label>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS_SEMANA.map((d, i) => (
              <button key={i} onClick={() => toggleDia(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  diasSemana.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Operation */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">3. Operação</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'pct' as const, label: '% Percentagem', desc: 'Ex: +20% verão' },
            { key: 'fixo' as const, label: '€ Valor fixo', desc: 'Ex: +15€ feriados' },
            { key: 'novo' as const, label: '€ Novo preço', desc: 'Ex: 80€ promoção' },
          ].map(op => (
            <button key={op.key} onClick={() => setOperacao(op.key)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                operacao === op.key ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}>
              <p className="text-xs font-semibold">{op.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{op.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>
            {operacao === 'pct' ? 'Percentagem (ex: +20 ou -15)' : operacao === 'fixo' ? 'Valor em euros (+/-)' : 'Novo preço por noite (€)'}
          </label>
          <input
            type="number"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder={operacao === 'pct' ? '+20' : operacao === 'fixo' ? '+15 ou -10' : '80'}
            className={inputCls}
          />
        </div>
      </div>

      {/* Step 4: Name & type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">4. Nome e tipo da regra</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nome da regra</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Verão 2025" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as PriceRuleTipo)} className={inputCls}>
              {Object.entries(RULE_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pré-visualização</p>
          {preview.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="font-medium">{p.prop}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{fmtMoney(p.antes)}</span>
                <span className="text-muted-foreground">→</span>
                <span className={`font-semibold ${p.depois > p.antes ? 'text-emerald-600' : p.depois < p.antes ? 'text-red-600' : ''}`}>
                  {fmtMoney(p.depois)}
                </span>
                {p.depois !== p.antes && (
                  <span className={`text-[10px] font-medium ${p.depois > p.antes ? 'text-emerald-600' : 'text-red-600'}`}>
                    ({p.depois > p.antes ? '+' : ''}{Math.round(((p.depois - p.antes) / p.antes) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={applyMassa}
        disabled={applying || selectedProps.length === 0 || !nome.trim() || !valor}
        className={`w-full rounded-xl py-3.5 font-semibold text-sm transition-colors disabled:opacity-40 ${
          applied ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
        }`}
      >
        {applying ? 'A aplicar...' : applied ? 'Aplicado com sucesso!' : `Aplicar a ${selectedProps.length} propriedade${selectedProps.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
