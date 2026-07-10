'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight, Plus, LogIn, LogOut, LayoutGrid, AlignJustify } from 'lucide-react'
import { fetchBookings, fetchProperties, fetchGuests } from '@/lib/fetcher'
import { occupancyForMonth } from '@/lib/reservations'
import type { Booking, Property } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/labels'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const TIMELINE_DAYS = 21

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({
  bookings,
  properties,
  guests,
}: {
  bookings: Booking[]
  properties: Property[]
  guests: { id: string; nome: string }[]
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10)
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    return Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(windowStart, i))
  }, [windowStart])

  const windowEnd = days[days.length - 1]

  const activeProps = properties.filter(p => p.ativo)

  const bookingsForProp = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const p of activeProps) {
      map.set(p.id, bookings.filter(b =>
        b.propriedade_id === p.id &&
        b.estado !== 'cancelada' &&
        b.estado !== 'no_show' &&
        b.check_in < addDays(windowEnd, 1) &&
        b.check_out > windowStart
      ))
    }
    return map
  }, [activeProps, bookings, windowStart, windowEnd])

  function prevWindow() { setWindowStart(w => addDays(w, -7)) }
  function nextWindow() { setWindowStart(w => addDays(w, 7)) }
  function goToday() {
    const d = new Date(); d.setDate(d.getDate() - 2)
    setWindowStart(d.toISOString().slice(0, 10))
  }

  const CELL_W = 40 // px per day column
  const ROW_H = 52  // px per property row
  const LABEL_W = 96 // px for property label column

  const todayOffset = daysBetween(windowStart, today)
  const todayInView = todayOffset >= 0 && todayOffset < TIMELINE_DAYS

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button onClick={prevWindow} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={nextWindow} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-muted-foreground flex-1">
          {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(windowStart + 'T00:00:00'))} –{' '}
          {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(windowEnd + 'T00:00:00'))}
        </span>
        {!todayInView && (
          <button onClick={goToday} className="text-xs font-semibold text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors">
            Hoje
          </button>
        )}
        <Link href="/reservas/nova"
          className="flex items-center gap-1 text-xs font-semibold text-primary">
          <Plus className="h-3.5 w-3.5" /> Nova
        </Link>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div style={{ minWidth: `${LABEL_W + CELL_W * TIMELINE_DAYS}px` }}>

          {/* Day headers */}
          <div className="flex sticky top-0 z-20 bg-background border-b border-border">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border" />
            {days.map(day => {
              const d = new Date(day + 'T00:00:00')
              const isToday = day === today
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div
                  key={day}
                  style={{ width: CELL_W, minWidth: CELL_W }}
                  className={`flex flex-col items-center justify-center py-2 shrink-0 border-r border-border/50 ${
                    isWeekend ? 'bg-muted/30' : ''
                  }`}
                >
                  <span className={`text-[9px] uppercase font-semibold leading-none mb-0.5 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {DAY_SHORT[d.getDay()]}
                  </span>
                  <span className={`text-xs font-bold leading-none rounded-full flex items-center justify-center ${
                    isToday ? 'h-5 w-5 bg-primary text-primary-foreground' : isWeekend ? 'text-muted-foreground' : 'text-foreground'
                  }`}>
                    {d.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Property rows */}
          {activeProps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 text-center py-16 px-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="h-8 w-8 text-primary" />
              </div>
              <div className="flex flex-col gap-1.5 max-w-xs">
                <p className="text-lg font-semibold">Sem propriedades ativas</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cria ou ativa uma propriedade para veres as reservas no calendário.
                </p>
              </div>
              <Link href="/propriedades/nova"
                className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
                <Plus className="h-4 w-4" /> Criar propriedade
              </Link>
              <Link href="/propriedades" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Gerir propriedades existentes →
              </Link>
            </div>
          ) : (
            activeProps.map((prop) => {
              const propBookings = bookingsForProp.get(prop.id) ?? []
              return (
                <div key={prop.id} className="flex border-b border-border" style={{ height: ROW_H }}>
                  {/* Property label */}
                  <div
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                    className="shrink-0 flex items-center px-2 gap-2 border-r border-border bg-card sticky left-0 z-10"
                  >
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: prop.cor }} />
                    <span className="text-xs font-medium truncate leading-tight">{prop.nome}</span>
                  </div>

                  {/* Day cells + booking spans */}
                  <div className="relative flex-1 flex">
                    {/* Background day cells */}
                    {days.map(day => {
                      const d = new Date(day + 'T00:00:00')
                      const isToday = day === today
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6
                      return (
                        <Link
                          key={day}
                          href={`/reservas/nova?propriedade=${prop.id}&checkin=${day}`}
                          style={{ width: CELL_W, minWidth: CELL_W }}
                          className={`h-full shrink-0 border-r border-border/40 transition-colors ${
                            isToday ? 'bg-primary/4' : isWeekend ? 'bg-muted/20' : 'hover:bg-muted/30'
                          }`}
                        />
                      )
                    })}

                    {/* Booking spans */}
                    {propBookings.map(b => {
                      const start = b.check_in < windowStart ? windowStart : b.check_in
                      const end = b.check_out > addDays(windowEnd, 1) ? addDays(windowEnd, 1) : b.check_out
                      const leftDays = daysBetween(windowStart, start)
                      const widthDays = daysBetween(start, end)
                      if (widthDays <= 0) return null

                      const leftPx = leftDays * CELL_W
                      const widthPx = widthDays * CELL_W - 2
                      const isCutLeft = b.check_in < windowStart
                      const isCutRight = b.check_out > addDays(windowEnd, 1)
                      const guestName = guests.find(g => g.id === b.hospede_id)?.nome ?? '—'

                      return (
                        <Link
                          key={b.id}
                          href={`/reservas/${b.id}`}
                          className="absolute top-1.5 bottom-1.5 flex items-center overflow-hidden z-10"
                          style={{
                            left: leftPx + 1,
                            width: widthPx,
                            backgroundColor: prop.cor,
                            borderRadius: `${isCutLeft ? 0 : 6}px ${isCutRight ? 0 : 6}px ${isCutRight ? 0 : 6}px ${isCutLeft ? 0 : 6}px`,
                            opacity: b.estado === 'checkout' ? 0.5 : 0.9,
                          }}
                        >
                          <span className="text-[10px] font-semibold text-white px-2 truncate leading-none">
                            {guestName}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      {activeProps.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-card">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">Clica numa célula vazia para criar reserva</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Monthly Grid View ────────────────────────────────────────────────────────

function getBookingsForDay(bookings: Booking[], date: string): Booking[] {
  return bookings.filter(b =>
    b.check_in <= date && b.check_out > date &&
    b.estado !== 'cancelada' && b.estado !== 'no_show'
  )
}

function DayCell({
  date, bookings, props, isToday, isSelected, onClick,
}: {
  date: string; bookings: Booking[]; props: Property[]; isToday: boolean; isSelected: boolean; onClick: () => void
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
          return (
            <div key={b.id} className="h-1 w-full rounded-sm"
              style={{ backgroundColor: prop?.cor ?? 'var(--primary)', opacity: 0.75 }} />
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

function GridView({
  bookings,
  properties,
  guests,
}: {
  bookings: Booking[]
  properties: Property[]
  guests: { id: string; nome: string }[]
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<string | null>(null)
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

  function guestName(hospede_id: string | null) {
    return guests.find(g => g.id === hospede_id)?.nome ?? '—'
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold">{MONTHS[month]} {year}</h2>
          {activeProps.length > 0 && (
            <p className="text-xs text-muted-foreground">{monthOccupancy}% ocupação média</p>
          )}
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col flex-1 px-3 pt-3 pb-6 gap-3 overflow-auto">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wide">{d}</div>
          ))}
        </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [guests, setGuests] = useState<{ id: string; nome: string }[]>([])
  const [view, setView] = useState<'timeline' | 'grid'>('timeline')

  useEffect(() => {
    if (!ownerId) return
    fetchBookings().then(setBookings)
    fetchProperties().then(setProperties)
    fetchGuests().then(g => setGuests(g.map(x => ({ id: x.id, nome: x.nome }))))
  }, [ownerId])

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'timeline' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlignJustify className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Mês
            </button>
          </div>
        </div>
      </header>

      {view === 'timeline' ? (
        <TimelineView bookings={bookings} properties={properties} guests={guests} />
      ) : (
        <GridView bookings={bookings} properties={properties} guests={guests} />
      )}
    </div>
  )
}
