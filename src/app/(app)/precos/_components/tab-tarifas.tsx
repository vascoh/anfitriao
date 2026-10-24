'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, X } from 'lucide-react'
import { uuid } from '@/lib/utils'
import type { Property, Tarifa, TarifaTipo, BookingSource } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'
import { guardar, eliminar } from '@/lib/guardar'
import { TARIFA_TIPO_LABEL, PLATAFORMAS } from './constantes'

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

export function TabTarifas({
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
      if (!await guardar('/api/tarifas', t)) return
      showToast('Tarifa guardada')
      onReload()
    } catch { showToast('Erro ao guardar', false) }
    setShowForm(false); setEditTarifa(null)
  }

  async function handleDelete(t: Tarifa) {
    try {
      if (!await eliminar(`/api/tarifas?id=${t.id}`)) return
      showToast('Tarifa eliminada')
      onReload()
    } catch { showToast('Erro ao eliminar', false) }
  }

  async function toggleActive(t: Tarifa) {
    try {
      if (!await guardar('/api/tarifas', { ...t, ativo: !t.ativo })) return
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
