'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Tag, Globe, Calendar, BarChart3, Settings2, RefreshCw } from 'lucide-react'
import { fetchProperties } from '@/lib/fetcher'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import type { Property, PriceRule, Tarifa, PlatformRate } from '@/lib/types'
import { useUser } from '@clerk/nextjs'
import { TabVisao } from './_components/tab-visao'
import { TabCalendario } from './_components/tab-calendario'
import { TabRegras } from './_components/tab-regras'
import { TabTarifas } from './_components/tab-tarifas'
import { TabPlataformas } from './_components/tab-plataformas'
import { TabMassa } from './_components/tab-massa'

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
  const [erro, setErro] = useState(false)

  const showToast = useCallback((msg: string, ok = true) => {
    if (ok) toast.success(msg)
    else toast.error(msg)
  }, [])

  /* Regras e tarifas vazias levam a recriá-las por cima das que existem; e uma
   * falha de rede deixava o indicador a rodar para sempre. */
  async function reload() {
    setLoading(true)
    const lista = (url: string) => fetch(url).then(r => {
      if (!r.ok) throw new Error(`Pedido falhou (${r.status})`)
      return r.json()
    })
    try {
      const [p, rRes, tRes, plRes] = await Promise.all([
        fetchProperties({ exigirSucesso: true }),
        lista('/api/price-rules'),
        lista('/api/tarifas'),
        lista('/api/platform-rates'),
      ])
      const [r, t, pl] = [rRes, tRes, plRes].map(x => Array.isArray(x) ? x : [])
      setProps(p)
      setRules(r)
      setTarifas(t)
      setPlatforms(pl)
      setErro(false)
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
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

      {erro ? (
        <ErroAoCarregar oQue="os preços" aviso="Não recries regras nem tarifas que já existem." aoTentar={reload} />
      ) : (
      <div className="flex-1 flex flex-col">
        {tab === 'visao'       && <TabVisao props={props} rules={rules} platforms={platforms} onReload={reload} showToast={showToast} />}
        {tab === 'calendario'  && <TabCalendario props={props} rules={rules} />}
        {tab === 'regras'      && <TabRegras props={props} rules={rules} onReload={reload} showToast={showToast} />}
        {tab === 'tarifas'     && <TabTarifas props={props} tarifas={tarifas} onReload={reload} showToast={showToast} />}
        {tab === 'plataformas' && <TabPlataformas props={props} platforms={platforms} onReload={reload} showToast={showToast} />}
        {tab === 'massa'       && <TabMassa props={props} onReload={reload} showToast={showToast} />}
      </div>
      )}

    </div>
  )
}
