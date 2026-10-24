'use client'

import { useState } from 'react'
import { Edit2, TrendingUp, TrendingDown } from 'lucide-react'
import { getPriceForDay } from '@/lib/reservations'
import { fmtMoney, today as localToday } from '@/lib/utils'
import type { Property, PriceRule, PlatformRate } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'
import { guardar } from '@/lib/guardar'

// ─── Tab: Visão Geral ──────────────────────────────────────────────────────────

export function TabVisao({
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
      /* O `try/catch` só apanhava falhas de rede. Uma recusa do servidor —
        * limite do plano, sem permissão — chega como resposta normal, e o
        * ecrã dizia "Preço atualizado" na mesma. */
      if (!await guardar('/api/properties', updated)) return
      fetch('/api/price-change-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: p.id, tipo: 'base_price_changed', descricao: `Preço base alterado de €${p.preco_base} para €${updated.preco_base}`, dadosAnteriores: prev, dadosNovos: { preco_base: updated.preco_base, taxa_limpeza: updated.taxa_limpeza } }) }).catch(() => {})
      showToast('Preço atualizado')
      onReload()
    } catch {
      showToast('Erro ao guardar', false)
    }
    setSaving(false)
    setEditing(null)
  }

  const today = localToday()

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
