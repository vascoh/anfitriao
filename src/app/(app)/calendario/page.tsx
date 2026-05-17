'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { store } from '@/lib/store'
import type { Booking, Property } from '@/lib/types'
import { SOURCE_COLOR } from '@/lib/labels'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getBookingsForDay(bookings: Booking[], date: string) {
  return bookings.filter(b =>
    b.check_in <= date && b.check_out > date &&
    b.estado !== 'cancelada' && b.estado !== 'no_show'
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export default function CalendarioPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])

  useEffect(() => {
    setBookings(store.getBookings())
    setProperties(store.getProperties())
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Monday-start: 0=Mon ... 6=Sun
    const startDow = (firstDay.getDay() + 6) % 7
    const days: (string | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(isoDate(year, month, d))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const selectedBookings = selected ? getBookingsForDay(bookings, selected) : []

  function propFor(id: string) { return properties.find(p => p.id === id) }
  function guestName(hospede_id: string) {
    return store.getGuests().find(g => g.id === hospede_id)?.nome ?? '—'
  }

  // Month occupancy stats
  const monthStart = isoDate(year, month, 1)
  const monthEnd = isoDate(year, month + 1, 0)
  const activeProps = properties.filter(p => p.ativo)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalSlots = activeProps.length * daysInMonth
  const occupiedSlots = bookings.filter(b =>
    b.estado !== 'cancelada' && b.estado !== 'no_show' &&
    b.check_in <= monthEnd && b.check_out > monthStart
  ).reduce((acc, b) => {
    const start = b.check_in > monthStart ? b.check_in : monthStart
    const end = b.check_out <= monthEnd ? b.check_out : monthEnd
    const n = Math.round((new Date(end).getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000)
    return acc + Math.max(0, n)
  }, 0)
  const occupancyPct = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold">{MONTHS[month]} {year}</h1>
            <p className="text-xs text-muted-foreground">{occupancyPct}% ocupação</p>
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col flex-1 p-4 gap-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((date, i) => {
            if (!date) return <div key={i} />
            const dayBookings = getBookingsForDay(bookings, date)
            const isToday = date === today
            const isSelected = date === selected
            const dayNum = parseInt(date.slice(8))

            return (
              <button
                key={date}
                onClick={() => setSelected(isSelected ? null : date)}
                className={`flex flex-col items-center rounded-lg p-1 min-h-12 transition-colors ${
                  isSelected ? 'bg-primary/10 ring-1 ring-primary' :
                  isToday ? 'bg-primary/5' : 'hover:bg-muted/60'
                }`}
              >
                <span className={`text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' :
                  isSelected ? 'text-primary' : 'text-foreground'
                }`}>
                  {dayNum}
                </span>
                <div className="flex flex-col gap-0.5 w-full mt-0.5">
                  {dayBookings.slice(0, 3).map(b => (
                    <div
                      key={b.id}
                      className="h-1 rounded-full w-full"
                      style={{ backgroundColor: SOURCE_COLOR[b.origem] }}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className="text-[8px] text-muted-foreground">+{dayBookings.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected day detail */}
        {selected && (
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selected + 'T00:00:00'))}
              </h2>
              <Link href={`/reservas/nova?checkin=${selected}`}
                className="flex items-center gap-1 text-xs font-medium text-primary">
                <Plus className="h-3.5 w-3.5" /> Nova
              </Link>
            </div>

            {selectedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem reservas neste dia.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedBookings.map(b => {
                  const p = propFor(b.propriedade_id)
                  const gName = guestName(b.hospede_id)
                  const isCheckIn = b.check_in === selected
                  const isCheckOut = b.check_out === selected

                  return (
                    <Link key={b.id} href={`/reservas/${b.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:bg-muted/40 transition-colors">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[b.origem] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{gName}</p>
                        <p className="text-xs text-muted-foreground truncate">{p?.nome}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {isCheckIn && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">entrada</span>}
                        {isCheckOut && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">saída</span>}
                        {!isCheckIn && !isCheckOut && (
                          <span className="text-xs text-muted-foreground">em casa</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Origem</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <LegendDot color="#FF5A5F" label="Airbnb" />
            <LegendDot color="#003580" label="Booking.com" />
            <LegendDot color="#C2714F" label="Direto" />
            <LegendDot color="#FFC72C" label="Expedia" />
            <LegendDot color="#3D82F6" label="VRBO" />
            <LegendDot color="#9CA3AF" label="Outro" />
          </div>
        </div>

        {/* Property occupancy bars */}
        {activeProps.length > 0 && (
          <div className="pt-2 border-t border-border flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ocupação este mês</p>
            {activeProps.map(p => {
              const propBookings = bookings.filter(b =>
                b.propriedade_id === p.id && b.estado !== 'cancelada' && b.estado !== 'no_show' &&
                b.check_in <= monthEnd && b.check_out > monthStart
              )
              const occupied = propBookings.reduce((acc, b) => {
                const start = b.check_in > monthStart ? b.check_in : monthStart
                const end = b.check_out <= monthEnd ? b.check_out : monthEnd
                return acc + Math.max(0, Math.round((new Date(end).getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000))
              }, 0)
              const pct = Math.round((occupied / daysInMonth) * 100)
              return (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.cor }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
