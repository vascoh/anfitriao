'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Percent, Euro, Calendar, X } from 'lucide-react'
import { uuid } from '@/lib/utils'
import type { Property, PriceRule, PriceRuleTipo } from '@/lib/types'
import { guardar, eliminar } from '@/lib/guardar'
import { RULE_TIPO_LABEL, RULE_TIPO_COLOR, DIAS_SEMANA } from './constantes'

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

export function TabRegras({
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
      if (!await guardar('/api/price-rules', r)) return
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
      if (!await eliminar(`/api/price-rules?id=${r.id}`)) return
      showToast('Regra eliminada')
      onReload()
    } catch {
      showToast('Erro ao eliminar', false)
    }
  }

  async function toggleActive(r: PriceRule) {
    try {
      if (!await guardar('/api/price-rules', { ...r, ativo: !r.ativo })) return
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
