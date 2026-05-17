'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, LogIn, LogOut } from 'lucide-react'
import { store, fmtDate } from '@/lib/store'
import { occupancyForMonth } from '@/lib/reservations'
import type { Booking, Property } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/labels'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getBookingsForDay(bookings: Booking[], date: string): Booking[] {
  return bookings.filter(b =>
    b.check_in <= date && b.check_out > date &&
    b.estado !== 'cancelada' && b.estado !== 'no_show'
  )
}

function DayCell({
  date,
  bookings,
  props,
  isToday,
  isSelected,
  onClick,
}: {
  date: string
  bookings: Booking[]
  props: Property[]
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}) {
  const dayBookings = getBookingsForDay(bookings, date)
  const dayNum = parseInt(date.slice(8))

  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center min-h-14 pt-1 pb-0.5 w-full transition-colors rounded-lg',
        isSelected ? 'bg-primary/8 ring-1 ring-primary/30' : isToday ? 'bg-muted/50' : 'hover:bg-muted/40',
      ].join(' ')}
    >
      <span className={[
        'text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full mb-0.5',
        isToday ? 'bg-primary text-primary-foreground' :
        isSelected ? 'text-primary font-bold' : 'text-foreground',
      ].join(' ')}>
        {dayNum}
      </span>

      <div className="flex flex-col gap-0.5 w-full px-0.5">
        {dayBookings.slice(0, 3).map(b => {
          const prop = props.find(p => p.id === b.propriedade_id)
          const isCheckIn = b.check_in === date
          const isCheckOut = new Date(b.check_out) <= new Date(date + 'T00:00:00')
          return (
            <div
              key={b.id}
              className="h-1 w-full rounded-sm"
              style={{ backgroundColor: prop?.cor ?? 'var(--primary)', opacity: 0.75 }}
            />
          )
        })}
        {dayBookings.length > 3 && (
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5 text-center">
            +{dayBookings.length - 3}
          </span>
        )}
      </div>
    </button>
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

  const today = now.toISOString().slice(0, 10)

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7
    const days: (string | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(isoDate(year, month, d))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [year, month])

  const activeProps = useMemo(() => properties.filter(p => p.ativo), [properties])

  const monthOccupancy = useMemo(() => {
    if (activeProps.length === 0) return 0
    const total = activeProps.reduce((sum, p) => {
      const { pct } = occupancyForMonth(bookings, p.id, year, month)
      return sum + pct
    }, 0)
    return Math.round(total / activeProps.length)
  }, [activeProps, bookings, year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const selectedBookings = selected ? getBookingsForDay(bookings, selected) : []

  function guestName(hospede_id: string) {
    return store.getGuests().find(g => g.id === hospede_id)?.nome ?? '—'
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold">{MONTHS[month]} {year}</h1>
            {activeProps.length > 0 && (
              <p className="text-xs text-muted-foreground">{monthOccupancy}% ocupação média</p>
            )}
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col flex-1 px-3 pt-3 pb-6 gap-3">

        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((date, i) => {
            if (!date) return <div key={i} />
            return (
              <DayCell
                key={date}
                date={date}
                bookings={bookings}
                props={properties}
                isToday={date === today}
                isSelected={date === selected}
                onClick={() => setSelected(selected === date ? null : date)}
              />
            )
          })}
        </div>

        {/* Property legend */}
        {activeProps.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {activeProps.map(p => (
              <div key={p.id} className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-sm shrink-0" style={{ backgroundColor: p.cor, opacity: 0.8 }} />
                <span className="text-xs text-muted-foreground">{p.nome}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected day detail */}
        {selected && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold capitalize">
                {new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selected + 'T00:00:00'))}
              </h2>
              <Link href={`/reservas/nova?checkin=${selected}`}
                className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Plus className="h-3.5 w-3.5" /> Nova
              </Link>
            </div>

            {selectedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem reservas neste dia.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedBookings.map(b => {
                  const prop = properties.find(p => p.id === b.propriedade_id)
                  const isCheckIn = b.check_in === selected
                  const isCheckOut = b.check_out === selected

                  return (
                    <Link key={b.id} href={`/reservas/${b.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:bg-muted/40 transition-colors">
                      <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{guestName(b.hospede_id)}</p>
                        <p className="text-xs text-muted-foreground truncate">{prop?.nome}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isCheckIn && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <LogIn className="h-3 w-3" /> entrada
                          </span>
                        )}
                        {isCheckOut && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            <LogOut className="h-3 w-3" /> saída
                          </span>
                        )}
                        {!isCheckIn && !isCheckOut && (
                          <span className="text-xs text-muted-foreground">em casa</span>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">{STATUS_LABEL[b.estado]}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Property occupancy bars */}
        {activeProps.length > 0 && (
          <div className="pt-3 border-t border-border flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ocupação em {MONTHS[month]}</p>
            {activeProps.map(p => {
              const { occupied, total, pct } = occupancyForMonth(bookings, p.id, year, month)
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{pct}% · {occupied}/{total}d</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: p.cor }} />
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
