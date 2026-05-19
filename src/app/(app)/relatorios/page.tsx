'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import { db } from '@/lib/db'
import { occupancyForMonth } from '@/lib/reservations'
import { fmtMoney, fmtDate, nights } from '@/lib/store'
import { SOURCE_LABEL, SOURCE_COLOR } from '@/lib/labels'
import type { Booking, Property, Guest, BookingSource } from '@/lib/types'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CHART_H = 120

function isActive(b: Booking) {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

function buildRevenueCsv(bookings: Booking[], properties: Property[], guests: Guest[], year: number): string {
  const cols = ['Check-in', 'Check-out', 'Noites', 'Hóspedes', 'Nome', 'Propriedade', 'Origem', 'Total (€)', 'Pago (€)', 'Em falta (€)', 'Estado']
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const rows = bookings
    .filter(b => b.check_in.startsWith(String(year)))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .map(b => {
      const prop = properties.find(p => p.id === b.propriedade_id)
      const guest = guests.find(g => g.id === b.hospede_id)
      const n = nights(b.check_in, b.check_out)
      const saldo = b.preco_total - b.preco_pago
      return [
        b.check_in,
        b.check_out,
        String(n),
        String(b.num_hospedes),
        guest?.nome ?? '',
        prop?.nome ?? '',
        SOURCE_LABEL[b.origem] ?? b.origem,
        b.preco_total.toFixed(2),
        b.preco_pago.toFixed(2),
        saldo.toFixed(2),
        b.estado,
      ].map(esc).join(',')
    })
  return [cols.map(esc).join(','), ...rows].join('\n')
}

function revenueByMonth(bookings: Booking[], year: number): number[] {
  const m = Array(12).fill(0)
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => { m[parseInt(b.check_in.slice(5, 7)) - 1] += b.preco_total })
  return m
}

function revenueByProperty(bookings: Booking[], properties: Property[], year: number): { id: string; nome: string; cor: string; revenue: number; count: number }[] {
  const map: Record<string, { nome: string; cor: string; revenue: number; count: number }> = {}
  properties.forEach(p => { map[p.id] = { nome: p.nome, cor: p.cor, revenue: 0, count: 0 } })
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => {
      if (map[b.propriedade_id]) {
        map[b.propriedade_id].revenue += b.preco_total
        map[b.propriedade_id].count++
      }
    })
  return Object.entries(map)
    .map(([id, v]) => ({ id, ...v }))
    .filter(x => x.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

function topGuests(bookings: Booking[], guests: Guest[], year: number, limit = 5): { id: string; nome: string; revenue: number; stays: number }[] {
  const map: Record<string, { nome: string; revenue: number; stays: number }> = {}
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => {
      const g = guests.find(x => x.id === b.hospede_id)
      if (!g) return
      if (!map[b.hospede_id]) map[b.hospede_id] = { nome: g.nome, revenue: 0, stays: 0 }
      map[b.hospede_id].revenue += b.preco_total
      map[b.hospede_id].stays++
    })
  return Object.entries(map)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
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
  const [guests, setGuests] = useState<Guest[]>([])
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    db.getBookings().then(setBookings)
    db.getProperties().then(setProperties)
    db.getGuests().then(setGuests)
  }, [])

  function exportRevenue() {
    const csv = buildRevenueCsv(bookings, properties, guests, year)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `receitas-${year}.csv`
    a.click()
  }

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

  const byProperty = useMemo(() => revenueByProperty(bookings, properties, year), [bookings, properties, year])
  const maxPropertyRevenue = Math.max(...byProperty.map(p => p.revenue), 1)

  const topGuestsList = useMemo(() => topGuests(bookings, guests, year), [bookings, guests, year])

  const totalBookings = useMemo(() =>
    bookings.filter(b => isActive(b) && b.check_in.startsWith(String(year))).length,
    [bookings, year]
  )

  const totalNights = useMemo(() =>
    bookings
      .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
      .reduce((sum, b) => sum + nights(b.check_in, b.check_out), 0),
    [bookings, year]
  )
  const adr = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0

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

  const forecastRevenue = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 28)
    const todayStr = today.toISOString().slice(0, 10)
    const horizonStr = horizon.toISOString().slice(0, 10)
    return bookings
      .filter(b => (b.estado === 'confirmada' || b.estado === 'pendente') && b.check_in >= todayStr && b.check_in < horizonStr)
      .reduce((sum, b) => sum + b.preco_total, 0)
  }, [bookings, now])

  return (
    <div className="flex flex-col min-h-full pb-8">

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
          <div className="flex items-center gap-2">
            {totalBookings > 0 && (
              <button
                onClick={exportRevenue}
                title={`Exportar receitas ${year} para CSV`}
                className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
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
          {adr > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ADR / noite</p>
              <p className="text-lg font-bold">{fmtMoney(adr)}</p>
            </div>
          )}
          {forecastRevenue > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Previsto 28d</p>
              <p className="text-lg font-bold text-primary">{fmtMoney(forecastRevenue)}</p>
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

        {/* Revenue by property */}
        {byProperty.length > 1 && (
          <section className="border-b border-border px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              Receita por propriedade · {year}
            </p>
            <div className="flex flex-col gap-5">
              {byProperty.map(p => (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                      <span className="text-sm font-medium truncate">{p.nome}</span>
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums">{fmtMoney(p.revenue)}</span>
                      <span className="text-[10px] text-muted-foreground">{p.count} res.</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((p.revenue / maxPropertyRevenue) * 100)}%`, backgroundColor: p.cor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top guests */}
        {topGuestsList.length > 0 && (
          <section className="border-b border-border px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              Top hóspedes · {year}
            </p>
            <div className="flex flex-col gap-1">
              {topGuestsList.map((g, i) => (
                <Link key={g.id} href={`/hospedes/${g.id}`}
                  className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <span className="text-xs font-bold text-muted-foreground/40 w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{g.nome[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.nome}</p>
                    <p className="text-xs text-muted-foreground">{g.stays} estadi{g.stays !== 1 ? 'as' : 'a'}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums shrink-0">{fmtMoney(g.revenue)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
