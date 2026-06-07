'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { fmtDate, fmtMoney, nights } from '@/lib/utils'
import { db } from '@/lib/db'
import { fetchGuests, fetchBookings, fetchProperties } from '@/lib/fetcher'
import type { Booking, Guest, Property, BookingStatus } from '@/lib/types'
import { STATUS_LABEL, STATUS_CLASS, SOURCE_LABEL, SOURCE_BG } from '@/lib/labels'
import { useUser } from '@clerk/nextjs'

type Filter = 'todas' | 'ativas' | 'proximas' | 'pendentes' | 'passadas'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas',    label: 'Todas' },
  { key: 'ativas',   label: 'Em casa' },
  { key: 'proximas', label: 'Próximas' },
  { key: 'pendentes',label: 'Pendentes' },
  { key: 'passadas', label: 'Passadas' },
]

function filterBookings(bookings: Booking[], filter: Filter): Booking[] {
  const t = new Date().toISOString().slice(0, 10)
  switch (filter) {
    case 'ativas':   return bookings.filter(b => b.estado === 'checkin')
    case 'proximas': return bookings.filter(b => b.estado === 'confirmada' && b.check_in > t)
    case 'pendentes':return bookings.filter(b => b.estado === 'pendente')
    case 'passadas': return bookings.filter(b => ['checkout', 'cancelada', 'no_show'].includes(b.estado))
    default:         return bookings
  }
}

function BookingRow({ b, guests, props }: { b: Booking; guests: Guest[]; props: Property[] }) {
  const guest = guests.find(g => g.id === b.hospede_id)
  const prop = props.find(p => p.id === b.propriedade_id)
  const n = nights(b.check_in, b.check_out)
  const saldo = b.preco_total - b.preco_pago
  const isActive = b.estado === 'checkin'

  return (
    <Link href={`/reservas/${b.id}`}
      className="flex items-start gap-3 px-4 py-3.5 active:bg-muted/40 transition-colors border-b border-border last:border-0">

      {/* Property color indicator */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className="h-7 w-1 rounded-full" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm truncate">{guest?.nome ?? '—'}</p>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-sm font-semibold">{fmtMoney(b.preco_total)}</span>
            {saldo > 0 && (
              <span className="text-[10px] font-semibold text-destructive">{fmtMoney(saldo)} em falta</span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground truncate mt-0.5">{prop?.nome ?? '—'}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLASS[b.estado]}`}>
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />}
            {STATUS_LABEL[b.estado]}
          </span>
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_BG[b.origem]}`}>
            {SOURCE_LABEL[b.origem]}
          </span>
          <span className="text-xs text-muted-foreground">
            {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {n}n
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ReservasPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [filter, setFilter] = useState<Filter>('todas')
  const [propFilter, setPropFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!ownerId) return
    fetchBookings().then(setBookings)
    fetchGuests().then(setGuests)
    fetchProperties().then(setProps)
  }, [ownerId])

  const filtered = useMemo(() => {
    let result = filterBookings(bookings, filter)
    if (propFilter) result = result.filter(b => b.propriedade_id === propFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(b => {
        const g = guests.find(x => x.id === b.hospede_id)
        const p = props.find(x => x.id === b.propriedade_id)
        return g?.nome?.toLowerCase().includes(q) || p?.nome?.toLowerCase().includes(q) || b.origem.includes(q)
      })
    }
    return result.sort((a, b) => {
      if (a.estado === 'checkin' && b.estado !== 'checkin') return -1
      if (b.estado === 'checkin' && a.estado !== 'checkin') return 1
      return a.check_in < b.check_in ? -1 : 1
    })
  }, [bookings, guests, props, filter, propFilter, search])

  const counts = useMemo(() => ({
    ativas:    bookings.filter(b => b.estado === 'checkin').length,
    pendentes: bookings.filter(b => b.estado === 'pendente').length,
  }), [bookings])

  const filteredStats = useMemo(() => {
    const active = filtered.filter(b => !['cancelada', 'no_show'].includes(b.estado))
    return {
      total: active.reduce((s, b) => s + b.preco_total, 0),
      pending: active.reduce((s, b) => s + Math.max(0, b.preco_total - b.preco_pago), 0),
    }
  }, [filtered])

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <Link href="/reservas/nova"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-semibold active:opacity-80 transition-opacity">
            <Plus className="h-3.5 w-3.5" />
            Nova
          </Link>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar hóspede ou propriedade..."
              className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => {
            const count = counts[f.key as keyof typeof counts]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.key
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
                {count ? (
                  <span className={`h-4 min-w-4 px-0.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    filter === f.key ? 'bg-background/20 text-background' : 'bg-foreground/10'
                  }`}>{count}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Property filter chips */}
        {props.length > 1 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setPropFilter(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                propFilter === null ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todas
            </button>
            {props.map(p => (
              <button
                key={p.id}
                onClick={() => setPropFilter(propFilter === p.id ? null : p.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  propFilter === p.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                style={propFilter === p.id ? { backgroundColor: p.cor + '22', color: p.cor } : {}}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                {p.nome}
              </button>
            ))}
          </div>
        )}

      </header>

      {filtered.length > 0 && (
        <div className="flex items-center gap-0 divide-x divide-border border-b border-border bg-muted/20 text-sm px-0">
          <div className="flex items-center gap-1.5 px-4 py-2 shrink-0">
            <span className="text-xs text-muted-foreground">{filtered.length} reserva{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {filteredStats.total > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 shrink-0">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-semibold">{fmtMoney(filteredStats.total)}</span>
            </div>
          )}
          {filteredStats.pending > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 shrink-0">
              <span className="text-xs text-muted-foreground">Por receber</span>
              <span className="text-sm font-semibold text-destructive">{fmtMoney(filteredStats.pending)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 text-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <p className="text-lg font-semibold">
                {filter === 'todas' ? 'Sem reservas' : 'Nenhuma reserva neste filtro'}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {filter === 'todas'
                  ? 'Cria uma reserva manualmente, recebe pedidos via website ou importa de Airbnb/Booking com iCal.'
                  : 'Tenta um filtro diferente.'}
              </p>
            </div>
            {filter === 'todas' && (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Link href="/reservas/nova"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
                  <Plus className="h-4 w-4" /> Nova reserva
                </Link>
                <Link href="/website" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Configura o website público →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border-b border-border">
            {filtered.map(b => (
              <BookingRow key={b.id} b={b} guests={guests} props={props} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
