'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fetchGuests, fetchBookings, fetchProperties } from '@/lib/fetcher'
import { useUser } from '@clerk/nextjs'
import { occupancyForMonth } from '@/lib/reservations'
import { fmtMoney, fmtDate, nights } from '@/lib/utils'
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

function revenueByProperty(
  bookings: Booking[],
  properties: Property[],
  year: number,
): { id: string; nome: string; cor: string; revenue: number; count: number; nights: number }[] {
  const map: Record<string, { nome: string; cor: string; revenue: number; count: number; nights: number }> = {}
  properties.forEach(p => { map[p.id] = { nome: p.nome, cor: p.cor, revenue: 0, count: 0, nights: 0 } })
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => {
      if (map[b.propriedade_id]) {
        map[b.propriedade_id].revenue += b.preco_total
        map[b.propriedade_id].count++
        map[b.propriedade_id].nights += nights(b.check_in, b.check_out)
      }
    })
  return Object.entries(map)
    .map(([id, v]) => ({ id, ...v }))
    .filter(x => x.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

function topGuests(
  bookings: Booking[],
  guests: Guest[],
  year: number,
  limit = 5,
): { id: string; nome: string; revenue: number; stays: number }[] {
  const map: Record<string, { nome: string; revenue: number; stays: number }> = {}
  bookings
    .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
    .forEach(b => {
      const g = guests.find(x => x.id === b.hospede_id)
      if (!g || !b.hospede_id) return
      if (!map[b.hospede_id]) map[b.hospede_id] = { nome: g.nome, revenue: 0, stays: 0 }
      map[b.hospede_id].revenue += b.preco_total
      map[b.hospede_id].stays++
    })
  return Object.entries(map)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

function occupancyByMonth(bookings: Booking[], properties: Property[], year: number): number[] {
  const activeProps = properties.filter(p => p.ativo)
  if (activeProps.length === 0) return Array(12).fill(0)
  return Array.from({ length: 12 }, (_, m) => {
    const total = activeProps.reduce((sum, p) => {
      const { pct } = occupancyForMonth(bookings, p.id, year, m)
      return sum + pct
    }, 0)
    return Math.round(total / activeProps.length)
  })
}

function statsBySource(
  bookings: Booking[],
  year: number,
): [BookingSource, { revenue: number; count: number }][] {
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

// RevPAR = Revenue / Available Room Nights
function calcRevPAR(
  bookings: Booking[],
  properties: Property[],
  year: number,
  month?: number, // undefined = full year
): number {
  const activeProps = properties.filter(p => p.ativo)
  if (activeProps.length === 0) return 0

  const isCurrentYear = year === new Date().getFullYear()
  const daysInPeriod = month !== undefined
    ? new Date(year, month + 1, 0).getDate()
    : isCurrentYear
      ? new Date().getDate() + (new Date().getMonth() > 0
          ? Array.from({ length: new Date().getMonth() }, (_, m) => new Date(year, m + 1, 0).getDate()).reduce((a, b) => a + b, 0)
          : 0)
      : 365 + (year % 4 === 0 ? 1 : 0)

  const availableNights = activeProps.length * daysInPeriod

  const revenue = bookings
    .filter(b => {
      if (!isActive(b)) return false
      if (month !== undefined) return b.check_in.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
      return b.check_in.startsWith(String(year))
    })
    .reduce((sum, b) => sum + b.preco_total, 0)

  return availableNights > 0 ? Math.round(revenue / availableNights) : 0
}

// Average Length of Stay
function calcAvgLOS(bookings: Booking[], year: number): number {
  const activeBookings = bookings.filter(b => isActive(b) && b.check_in.startsWith(String(year)))
  if (activeBookings.length === 0) return 0
  const totalNights = activeBookings.reduce((sum, b) => sum + nights(b.check_in, b.check_out), 0)
  return Math.round((totalNights / activeBookings.length) * 10) / 10
}

// Cancellation rate
function calcCancellationRate(bookings: Booking[], year: number): number {
  const yearBookings = bookings.filter(b => b.check_in.startsWith(String(year)))
  if (yearBookings.length === 0) return 0
  const cancelled = yearBookings.filter(b => b.estado === 'cancelada' || b.estado === 'no_show').length
  return Math.round((cancelled / yearBookings.length) * 100)
}

// Payment collection rate
function calcCollectionRate(bookings: Booking[], year: number): number {
  const activeBookings = bookings.filter(b => isActive(b) && b.check_in.startsWith(String(year)) && b.preco_total > 0)
  if (activeBookings.length === 0) return 100
  const totalDue = activeBookings.reduce((sum, b) => sum + b.preco_total, 0)
  const totalPaid = activeBookings.reduce((sum, b) => sum + b.preco_pago, 0)
  return Math.round((totalPaid / totalDue) * 100)
}

function Trend({ value, suffix = '%', inverse = false }: { value: number; suffix?: string; inverse?: boolean }) {
  if (value === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  const positive = inverse ? value < 0 : value > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-destructive'}`}>
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  )
}

export default function RelatoriosPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loaded, setLoaded] = useState(false)
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchBookings(), fetchProperties(), fetchGuests()])
      .then(([b, p, g]) => { setBookings(b); setProperties(p); setGuests(g) })
      .finally(() => setLoaded(true))
  }, [ownerId])

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
  const occupancyMonthly = useMemo(() => occupancyByMonth(bookings, properties, year), [bookings, properties, year])
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
  const revpar = useMemo(() => calcRevPAR(bookings, properties, year), [bookings, properties, year])
  const avgLOS = useMemo(() => calcAvgLOS(bookings, year), [bookings, year])
  const cancellationRate = useMemo(() => calcCancellationRate(bookings, year), [bookings, year])
  const collectionRate = useMemo(() => calcCollectionRate(bookings, year), [bookings, year])

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

  // Year-over-year comparison
  const prevYear = year - 1
  const prevYearRevenue = useMemo(() =>
    bookings.filter(b => isActive(b) && b.check_in.startsWith(String(prevYear))).reduce((s, b) => s + b.preco_total, 0),
    [bookings, prevYear]
  )
  const yoyChange = prevYearRevenue > 0
    ? Math.round(((totalRevenue - prevYearRevenue) / prevYearRevenue) * 100)
    : 0

  if (!loaded) {
    return (
      <div className="flex flex-col min-h-full pb-8 animate-pulse">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="h-7 w-28 rounded-lg bg-muted" />
            <div className="h-8 w-16 rounded-lg bg-muted" />
          </div>
          <div className="flex items-stretch border-t border-border divide-x divide-border overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5 shrink-0 flex flex-col gap-1.5">
                <div className="h-2.5 w-16 rounded bg-muted" />
                <div className="h-6 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </header>
        <div className="flex flex-col max-w-5xl w-full">
          <div className="border-b border-border px-4 lg:px-8 py-6">
            <div className="h-3 w-32 rounded bg-muted mb-5" />
            <div className="flex items-end gap-px sm:gap-1" style={{ height: '120px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-muted" style={{ height: `${[50, 70, 45, 80, 60, 90, 55, 75, 40, 65, 85, 50][i]}px` }} />
                  <div className="h-2 w-4 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 lg:px-8 py-6 border-b border-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-2">
                <div className="h-2.5 w-20 rounded bg-muted" />
                <div className="h-6 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Empty state — sem dados para mostrar
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col min-h-full pb-8">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-4">
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center gap-5 text-center py-20 px-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-xs">
            <p className="text-lg font-semibold">Ainda sem dados</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os relatórios de receita e ocupação aparecem aqui assim que tiveres reservas. Cria uma manualmente ou sincroniza com Airbnb/Booking.
            </p>
          </div>
          <Link href="/reservas/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
            Criar reserva
          </Link>
          <Link href="/propriedades" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Configurar sync iCal →
          </Link>
        </div>
      </div>
    )
  }

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

        {/* KPI strip */}
        <div className="flex items-stretch border-t border-border divide-x divide-border overflow-x-auto">
          <div className="px-4 lg:px-6 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Receita {year}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold">{fmtMoney(totalRevenue)}</p>
              {prevYearRevenue > 0 && <Trend value={yoyChange} />}
            </div>
          </div>
          <div className="px-4 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Reservas</p>
            <p className="text-lg font-bold">{totalBookings}</p>
          </div>
          <div className="px-4 py-2.5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ocupação</p>
            <p className="text-lg font-bold">{avgOccupancy}%</p>
          </div>
          {adr > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ADR</p>
              <p className="text-lg font-bold">{fmtMoney(adr)}</p>
            </div>
          )}
          {revpar > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">RevPAR</p>
              <p className="text-lg font-bold text-primary">{fmtMoney(revpar)}</p>
            </div>
          )}
          {avgLOS > 0 && (
            <div className="px-4 py-2.5 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">LOS Médio</p>
              <p className="text-lg font-bold">{avgLOS}n</p>
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

        {/* Revenue bar chart */}
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

        {/* Occupancy bar chart */}
        {activeProps.length > 0 && (
          <section className="border-b border-border px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              Ocupação mensal · {year}
            </p>
            <div className="flex items-end gap-px sm:gap-1">
              {occupancyMonthly.map((pct, i) => {
                const barH = pct > 0 ? Math.max(4, Math.round((pct / 100) * CHART_H)) : 0
                const isCurrent = i === currentMonth
                const isFuture = year === now.getFullYear() && i > now.getMonth()
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className={`text-[9px] transition-opacity text-muted-foreground ${pct > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
                      {pct}%
                    </span>
                    <div className="w-full flex items-end justify-center" style={{ height: `${CHART_H}px` }}>
                      {barH > 0 ? (
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${barH}px`,
                            backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : 'hsl(var(--primary))',
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
          </section>
        )}

        {/* Advanced KPIs */}
        {totalBookings > 0 && (
          <section className="border-b border-border px-4 lg:px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              KPIs · {year}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">RevPAR</p>
                <p className="text-xl font-bold">{fmtMoney(revpar)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">receita por noite disponível</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">ADR</p>
                <p className="text-xl font-bold">{fmtMoney(adr)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">preço médio por noite vendida</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">LOS</p>
                <p className="text-xl font-bold">{avgLOS > 0 ? `${avgLOS}n` : '—'}</p>
                <p className="text-[10px] text-muted-foreground mt-1">estadia média</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Cobrança</p>
                <p className={`text-xl font-bold ${collectionRate >= 90 ? 'text-emerald-600' : collectionRate >= 70 ? 'text-amber-600' : 'text-destructive'}`}>
                  {collectionRate}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">pagamentos cobrados</p>
              </div>
              {cancellationRate > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Cancelamentos</p>
                  <p className={`text-xl font-bold ${cancellationRate <= 5 ? 'text-emerald-600' : cancellationRate <= 15 ? 'text-amber-600' : 'text-destructive'}`}>
                    {cancellationRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">taxa de cancelamento</p>
                </div>
              )}
              {totalNights > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Noites vendidas</p>
                  <p className="text-xl font-bold">{totalNights}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">em {totalBookings} reservas</p>
                </div>
              )}
            </div>
          </section>
        )}

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
                {bySource.map(([origem, stats]) => {
                  const pct = totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 100) : 0
                  return (
                    <div key={origem} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[origem] }} />
                          <span className="text-sm font-medium">{SOURCE_LABEL[origem]}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold tabular-nums">{fmtMoney(stats.revenue)}</span>
                          <span className="text-[10px] text-muted-foreground">{pct}% · {stats.count}r</span>
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
                  )
                })}
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
              {byProperty.map(p => {
                const propAdr = p.nights > 0 ? Math.round(p.revenue / p.nights) : 0
                return (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                        <span className="text-sm font-medium truncate">{p.nome}</span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{fmtMoney(p.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.count}r · {propAdr > 0 ? `ADR ${fmtMoney(propAdr)}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((p.revenue / maxPropertyRevenue) * 100)}%`, backgroundColor: p.cor }}
                      />
                    </div>
                  </div>
                )
              })}
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
