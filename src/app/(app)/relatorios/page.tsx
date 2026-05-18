'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/db'
import { occupancyForMonth } from '@/lib/reservations'
import { fmtMoney } from '@/lib/store'
import { SOURCE_LABEL, SOURCE_COLOR } from '@/lib/labels'
import type { Booking, Property, BookingSource } from '@/lib/types'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CHART_H = 120

function isActive(b: Booking) {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

function revenueByMonth(bookings: Booking[], year: number): number[] {
  const m = Array(12).fill(0)
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => { m[parseInt(b.check_in.slice(5, 7)) - 1] += b.preco_total })
  return m
}

function statsBySource(bookings: Booking[], year: number): [BookingSource, { revenue: number; count: number }][] {
  const map: Partial<Record<BookingSource, { revenue: number; count: number }>> = {}
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => {
      if (!map[b.origem]) map[b.origem] = { revenue: 0, count: 0 }
      map[b.origem]!.revenue += b.preco_total
      map[b.origem]!.count++
    })
  return (Object.entries(map) as [BookingSource, { revenue: number; count: number }][])
    .sort((a, b) => b[1].revenue - a[1].revenue)
}

export default function RelatoriosPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    db.getBookings().then(setBookings)
    db.getProperties().then(setProperties)
  }, [])

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    bookings.forEach(b => years.add(parseInt(b.check_in.slice(0, 4))))
    return [...years].sort((a, b) => b - a)
  }, [bookings, now])

  const monthly = useMemo(() => revenueByMonth(bookings, year), [bookings, year])
  const maxMonthly = Math.max(...monthly, 1)
  const totalRevenue = monthly.reduce((a, v) => a + v, 0)

  const bySource = useMemo(() => statsBySource(bookings, year), [bookings, year])
  const maxSourceRevenue = Math.max(...bySource.map(([, s]) => s.revenue), 1)

  const totalBookings = useMemo(() =>
    bookings.filter(b => isActive(b) && b.check_in.startsWith(String(year))).length,
    [bookings, year]
  )

  const activeProps = useMemo(() => properties.filter(p => p.ativo), [properties])
  const occupancyMonth = year === now.getFullYear() ? now.getMonth() : 11

  const propOccupancy = useMemo(() =>
    activeProps.map(p => ({ ...p, occ: occupancyForMonth(bookings, p.id, year, occupancyMonth) })),
    [bookings, activeProps, year, occupancyMonth]
  )

  const avgOccupancy = propOccupancy.length > 0
    ? Math.round(propOccupancy.reduce((a, p) => a + p.occ.pct, 0) / propOccupancy.length)
    : 0

  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1

  return (
    <div className="flex flex-col min-h-full pb-8">

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
          {availableYears.length > 1 && (
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
              {availableYears.map(y => (
                <button key={y} onClick={() => setYear(y)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    y === year
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex items-stretch border-t border-border divide-x divide-border overflow-x-auto">
          <div className="px-4 lg:px-6 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Receita {year}</p>
            <p className="text-lg font-bold">{fmtMoney(totalRevenue)}</p>
          </div>
          <div className="px-4 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Reservas</p>
            <p className="text-lg font-bold">{totalBookings}</p>
          </div>
          <div className="px-4 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ocupação média</p>
            <p className="text-lg font-bold">{avgOccupancy}%</p>
          </div>
          {totalBookings > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Valor médio</p>
              <p className="text-lg font-bold">{fmtMoney(Math.round(totalRevenue / totalBookings))}</p>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col max-w-5xl w-full">

        {/* Monthly bar chart */}
        <section className="border-b border-border px-4 lg:px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            Receita mensal · {year}
          </p>
          {totalRevenue === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Sem dados para {year}
            </div>
          ) : (
            <div className="flex items-end gap-px sm:gap-1">
              {monthly.map((v, i) => {
                const barH = v > 0 ? Math.max(4, Math.round((v / maxMonthly) * CHART_H)) : 0
                const isCurrent = i === currentMonth
                const isFuture = year === now.getFullYear() && i > now.getMonth()
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className={`text-[9px] transition-opacity text-muted-foreground ${v > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
                      {fmtMoney(v)}
                    </span>
                    <div className="w-full flex items-end justify-center" style={{ height: `${CHART_H}px` }}>
                      {barH > 0 ? (
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${barH}px`,
                            backgroundColor: `hsl(var(--primary))`,
                            opacity: isFuture ? 0.25 : isCurrent ? 1 : 0.65,
                          }}
                        />
                      ) : (
                        <div className="w-full h-0.5 rounded-full bg-border" />
                      )}
                    </div>
                    <span className={`text-[10px] leading-none ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                      {MONTHS_SHORT[i]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Occupancy + Source grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border">

          {/* Occupancy per property */}
          <section className="px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              Ocupação · {MONTHS_SHORT[occupancyMonth]}
            </p>
            {propOccupancy.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem propriedades ativas</p>
            ) : (
              <div className="flex flex-col gap-5">
                {propOccupancy.map(p => (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                        <span className="text-sm font-medium truncate">{p.nome}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0">{p.occ.pct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${p.occ.pct}%`, backgroundColor: p.cor }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {p.occ.occupied} de {p.occ.total} dias ocupados
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Revenue by source */}
          <section className="px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              Por origem · {year}
            </p>
            {bySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para {year}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {bySource.map(([origem, stats]) => (
                  <div key={origem} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[origem] }} />
                        <span className="text-sm font-medium">{SOURCE_LABEL[origem]}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold tabular-nums">{fmtMoney(stats.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground">{stats.count} res.</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((stats.revenue / maxSourceRevenue) * 100)}%`,
                          backgroundColor: SOURCE_COLOR[origem],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
