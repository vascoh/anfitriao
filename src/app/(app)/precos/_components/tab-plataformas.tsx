'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { fmtMoney, uuid } from '@/lib/utils'
import type { Property, PlatformRate, BookingSource } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'
import { guardar } from '@/lib/guardar'
import { PLATAFORMAS } from './constantes'

// ─── Tab: Plataformas ──────────────────────────────────────────────────────────

export function TabPlataformas({
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
      if (!await guardar('/api/platform-rates', rate)) return
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
