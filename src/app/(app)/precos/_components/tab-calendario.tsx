'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getPriceForDay } from '@/lib/reservations'
import { fmtMoney, today as localToday } from '@/lib/utils'
import type { Property, PriceRule } from '@/lib/types'

// ─── Tab: Calendário de Preços ─────────────────────────────────────────────────

export function TabCalendario({ props, rules }: { props: Property[]; rules: PriceRule[] }) {
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
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  const today = localToday()
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
