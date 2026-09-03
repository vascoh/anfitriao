'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight, Plus, LogIn, LogOut, LayoutGrid, AlignJustify } from 'lucide-react'
import { fetchBookings, fetchProperties, fetchGuests } from '@/lib/fetcher'
import { occupancyForMonth, unidadesReservaveis, eBloqueio, rotuloDeBloqueio } from '@/lib/reservations'
import { nights } from '@/lib/utils'
import { addDays, today as localToday } from '@/lib/utils'
import type { Booking, Property, BookingSource } from '@/lib/types'
import { STATUS_LABEL, SOURCE_LABEL, SOURCE_COLOR } from '@/lib/labels'
import { estadoDoAlojamento } from '@/lib/canais'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const TIMELINE_DAYS = 21

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/* `nights` de `lib/utils` faz exatamente esta conta, com o mesmo tratamento
 * de fuso — era uma terceira cópia da mesma fórmula. */
const daysBetween = nights

/* ── De onde veio esta reserva ──────────────────────────────────────────────
 *
 * O calendário pintava as reservas com a cor da **propriedade**. Na vista de
 * timeline isso não dizia nada: cada linha já é uma propriedade, portanto a
 * cor repetia a informação que o rótulo da linha dava — e a pergunta que o
 * anfitrião faz ao olhar para o calendário («esta reserva veio do Airbnb ou do
 * meu site?») não tinha resposta em lado nenhum, apesar de `origem` estar
 * guardada em todas as reservas desde sempre.
 *
 * Passa a ser o canal a dar a cor. As cores das plataformas já existiam em
 * `lib/labels` e não eram usadas em sítio nenhum do calendário. */

function origemDe(b: Booking): BookingSource {
  return (b.origem ?? 'direto') as BookingSource
}

/* `eBloqueio` vive em `lib/reservations`: a regra é a mesma no feed que se
 * exporta e tem um caso que não se adivinha — as reservas importadas dos
 * canais também não têm hóspede. Ver lá o porquê. */

/**
 * O que se escreve na barra da reserva.
 *
 * Uma reserva importada não traz nome — o iCal não transporta hóspedes. Pôr-lhe
 * «Sem nome» descreve a limitação da ferramenta em vez de dizer o que se sabe:
 * de onde é que ela veio. Vale mais ler «Airbnb» do que um vazio.
 */
function nomeDaReserva(b: Booking, guests: { id: string; nome: string }[]): string {
  // Ver `rotuloDeBloqueio`: a mesma frase no calendário, na lista e no detalhe.
  if (eBloqueio(b)) return rotuloDeBloqueio(b)
  const nome = guests.find(g => g.id === b.hospede_id)?.nome
  return nome ?? (b.uid_externo ? SOURCE_LABEL[origemDe(b)] : 'Sem nome')
}

function corDaReserva(b: Booking): string {
  return eBloqueio(b) ? '#6B7280' : SOURCE_COLOR[origemDe(b)]
}

/** Legenda dos canais — só os que aparecem mesmo no que está a ser mostrado. */
function LegendaCanais({ bookings }: { bookings: Booking[] }) {
  const presentes = useMemo(() => {
    const s = new Set<string>()
    let temBloqueio = false
    for (const b of bookings) {
      if (eBloqueio(b)) temBloqueio = true
      else s.add(origemDe(b))
    }
    return { canais: [...s] as BookingSource[], temBloqueio }
  }, [bookings])

  if (presentes.canais.length === 0 && !presentes.temBloqueio) return null

  return (
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
      {presentes.canais.map(c => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLOR[c] }} aria-hidden />
          <span className="text-[11px] text-muted-foreground">{SOURCE_LABEL[c]}</span>
        </span>
      ))}
      {presentes.temBloqueio && (
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm shrink-0 bg-gray-500" aria-hidden />
          <span className="text-[11px] text-muted-foreground">Bloqueio</span>
        </span>
      )}
    </div>
  )
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
  const today = useMemo(() => localToday(), [])
  const [windowStart, setWindowStart] = useState(() => addDays(localToday(), -2))
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    return Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(windowStart, i))
  }, [windowStart])

  const windowEnd = days[days.length - 1]

  /* Só o que se aluga.
   *
   * Filtrava-se por `ativo`, o que punha a casa-mãe de uma casa com quartos
   * a ocupar uma linha **sempre livre** — as reservas vivem nos quartos desde
   * 30/07. O anfitrião olhava para uma faixa vazia e via disponibilidade que
   * não existe. É a mesma correção que o `/hoje` levou nesse dia e o feed
   * iCal a 12/08; faltava o calendário. */
  const activeProps = unidadesReservaveis(properties)

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
    setWindowStart(addDays(localToday(), -2))
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
                      const bloqueio = eBloqueio(b)
                      const guestName = nomeDaReserva(b, guests)
                      const canal = SOURCE_LABEL[origemDe(b)]

                      /* O que o anfitrião precisa de saber sem clicar: quem,
                       * de onde, e quando entra e sai. O `title` diz tudo por
                       * extenso — a barra só tem espaço para o nome. */
                      const descricao = bloqueio
                        ? `Bloqueado · ${b.check_in} a ${b.check_out}`
                        : `${guestName} · ${canal} · entrada ${b.check_in}, saída ${b.check_out}`

                      return (
                        <Link
                          key={b.id}
                          href={`/reservas/${b.id}`}
                          title={descricao}
                          aria-label={descricao}
                          className="absolute top-1.5 bottom-1.5 flex items-center overflow-hidden z-10"
                          style={{
                            left: leftPx + 1,
                            width: widthPx,
                            backgroundColor: corDaReserva(b),
                            /* O canto redondo marca o início e o fim reais da
                             * estadia; a ponta direita fica em bico quando a
                             * reserva continua para lá da janela. */
                            borderRadius: `${isCutLeft ? 0 : 6}px ${isCutRight ? 0 : 6}px ${isCutRight ? 0 : 6}px ${isCutLeft ? 0 : 6}px`,
                            opacity: b.estado === 'checkout' ? 0.45 : b.estado === 'pendente' ? 0.6 : 0.92,
                            /* Pendente às riscas: uma reserva por confirmar não
                             * pode ler-se como uma noite vendida. */
                            backgroundImage: b.estado === 'pendente'
                              ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px)'
                              : undefined,
                          }}
                        >
                          {!isCutLeft && (
                            <span className="h-full w-1 bg-white/70 shrink-0" aria-hidden title="Entrada" />
                          )}
                          <span className="text-[10px] font-semibold text-white px-1.5 truncate leading-none">
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
        <div className="px-4 py-3 border-t border-border bg-card flex flex-col gap-2">
          <LegendaCanais bookings={bookings} />
          <span className="text-[10px] text-muted-foreground">
            A cor diz de que canal veio a reserva. Clica numa célula vazia para criar uma reserva.
          </span>
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
  date, bookings, isToday, isSelected, onClick,
}: {
  date: string; bookings: Booking[]; isToday: boolean; isSelected: boolean; onClick: () => void
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
        {/* A mesma regra da timeline: a cor é o canal. Ter as duas vistas a
         * usar a cor para coisas diferentes no mesmo ecrã custava mais do que
         * valia — quem aprendia "vermelho = Airbnb" numa desaprendia na outra. */}
        {dayBookings.slice(0, 3).map(b => (
          <div key={b.id} className="h-1 w-full rounded-sm"
            style={{ backgroundColor: corDaReserva(b), opacity: 0.85 }} />
        ))}
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
  const today = localToday()

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

  /* A ocupação divide-se pelas unidades **alugáveis**.
   *
   * Com 3 quartos e a casa-mãe, o denominador era 4 em vez de 3 e a ocupação
   * do mês aparecia ~25% abaixo da real. É o mesmo erro que foi corrigido a
   * 30/07 em seis sítios — o `/hoje`, os `/relatorios` e o email mensal —,
   * e que aqui ficou. */
  const activeProps = useMemo(() => unidadesReservaveis(properties), [properties])

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
                isToday={date === today}
                isSelected={date === selected}
                onClick={() => setSelected(selected === date ? null : date)}
              />
            )
          })}
        </div>

        {activeProps.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <LegendaCanais bookings={bookings} />
            <span className="text-[10px] text-muted-foreground">
              A cor diz de que canal veio a reserva. Toca num dia para ver o detalhe.
            </span>
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
                      <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: corDaReserva(b) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {nomeDaReserva(b, guests)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                          <span className="truncate">{prop?.nome}</span>
                          {!eBloqueio(b) && (
                            <>
                              <span aria-hidden>·</span>
                              <span
                                className="inline-flex items-center gap-1 shrink-0"
                                title={`Reserva vinda de ${SOURCE_LABEL[origemDe(b)]}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SOURCE_COLOR[origemDe(b)] }} aria-hidden />
                                {SOURCE_LABEL[origemDe(b)]}
                              </span>
                            </>
                          )}
                        </p>
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
  const [aCarregar, setACarregar] = useState(true)
  const [erro, setErro] = useState(false)

  /* Aqui carrega-se tudo de propósito: o calendário navega para qualquer ano,
   * e uma janela fixa dava meses vazios a quem recuasse o suficiente. Deixou
   * de ser um problema de correção quando `/api/bookings` passou a paginar —
   * antes, "tudo" eram as 1000 linhas mais recentes e o resto do calendário
   * aparecia livre.
   *
   * O estado de carregamento não existia, e a diferença entre "ainda não
   * chegou" e "não há nada" é a diferença entre um calendário vazio por um
   * segundo e um "Sem propriedades ativas" a mentir a quem tem seis. Pior: as
   * três promessas não tinham `catch`, portanto uma falha de rede deixava o
   * calendário vazio para sempre, sem um erro em lado nenhum. */
  useEffect(() => {
    if (!ownerId) return
    let vivo = true
    Promise.all([fetchBookings(), fetchProperties(), fetchGuests()])
      .then(([b, p, g]) => {
        if (!vivo) return
        setBookings(b)
        setProperties(p)
        setGuests(g.map(x => ({ id: x.id, nome: x.nome })))
      })
      .catch(() => { if (vivo) setErro(true) })
      .finally(() => { if (vivo) setACarregar(false) })
    return () => { vivo = false }
  }, [ownerId])

  /* Um calendário que não sabe de uma reserva é indistinguível de um
   * calendário sem reservas — e é sobre ele que se decide vender uma noite.
   * Quando um canal está em erro ou parado, isso tem de se ver aqui, e não só
   * na página de canais onde ninguém vai por iniciativa própria. */
  const canaisComProblema = useMemo(
    () => unidadesReservaveis(properties).filter(p => {
      const e = estadoDoAlojamento(p.ical_feeds ?? [])
      return e === 'erro' || e === 'desatualizado'
    }),
    [properties],
  )

  if (aCarregar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3 py-20">
        <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden />
        <p className="text-sm text-muted-foreground">A carregar o calendário…</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 py-20 px-6 text-center">
        <p className="text-base font-semibold">Não foi possível carregar o calendário</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Pode ter sido uma falha de rede. Não assumas que as datas estão livres sem confirmar.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Tentar outra vez
        </button>
      </div>
    )
  }

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
        {canaisComProblema.length > 0 && (
          <Link
            href="/canais"
            className="flex items-start gap-2 px-4 py-2.5 border-t border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />
            <span className="text-xs leading-relaxed">
              <strong>
                {canaisComProblema.length === 1
                  ? `O calendário de "${canaisComProblema[0].nome}" não está a sincronizar.`
                  : `${canaisComProblema.length} alojamentos não estão a sincronizar.`}
              </strong>{' '}
              Podem existir reservas nas plataformas que não aparecem aqui. Ver canais →
            </span>
          </Link>
        )}
      </header>

      {view === 'timeline' ? (
        <TimelineView bookings={bookings} properties={properties} guests={guests} />
      ) : (
        <GridView bookings={bookings} properties={properties} guests={guests} />
      )}
    </div>
  )
}
