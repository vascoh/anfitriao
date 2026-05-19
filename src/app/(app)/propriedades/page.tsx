'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, Wifi, BedDouble } from 'lucide-react'
import { fmtMoney } from '@/lib/store'
import { db } from '@/lib/db'
import { occupancyForMonth } from '@/lib/reservations'
import type { Property, Booking, Guest } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

export default function PropriedadesPage() {
  const [props, setProps] = useState<Property[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])

  useEffect(() => {
    db.getProperties().then(setProps)
    db.getBookings().then(setBookings)
    db.getGuests().then(setGuests)
  }, [])

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()

  function activeBooking(propId: string) {
    return bookings.find(b => b.propriedade_id === propId && b.estado === 'checkin')
  }
  function propStats(propId: string) {
    const pb = bookings.filter(b => b.propriedade_id === propId && ['confirmada', 'checkin', 'checkout'].includes(b.estado))
    return { count: pb.length, revenue: pb.reduce((s, b) => s + (b.preco_total ?? 0), 0) }
  }

  function nextBooking(propId: string) {
    const t = new Date().toISOString().slice(0, 10)
    return bookings
      .filter(b => b.propriedade_id === propId && b.estado === 'confirmada' && b.check_in >= t)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Propriedades</h1>
          <Link href="/propriedades/nova"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium active:opacity-80 transition-opacity">
            <Plus className="h-3.5 w-3.5" /> Nova
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {props.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
            <p className="text-base font-medium text-foreground/60">Sem propriedades</p>
            <Link href="/propriedades/nova" className="text-primary text-sm font-medium">Adicionar primeira propriedade</Link>
          </div>
        ) : (
          props.map(p => {
            const active = activeBooking(p.id)
            const next = nextBooking(p.id)
            const activeGuest = active ? guests.find(g => g.id === active.hospede_id) : null
            const nextGuest = next ? guests.find(g => g.id === next.hospede_id) : null

            const stats = propStats(p.id)
            const occ = occupancyForMonth(bookings, p.id, thisYear, thisMonth)
            return (
              <Link key={p.id} href={`/propriedades/${p.id}`}
                className="rounded-xl border border-border bg-card overflow-hidden active:bg-muted/40 transition-colors">
                {/* Color accent bar */}
                <div className="h-1.5 w-full" style={{ backgroundColor: p.cor }} />

                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base leading-tight">{p.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {occ.pct > 0 && (
                        <span className={`text-xs font-bold tabular-nums ${occ.pct >= 80 ? 'text-emerald-600' : occ.pct >= 50 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {occ.pct}%
                        </span>
                      )}
                      <div className={`h-3 w-3 rounded-full ${p.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    </div>
                  </div>

                  {/* Specs */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.quartos} quarto{p.quartos !== 1 ? 's' : ''}</span>
                    <span>max {p.capacidade} pax</span>
                    <span className="font-medium text-foreground">€{p.preco_base}/noite</span>
                  </div>

                  {/* Revenue stats + occupancy bar */}
                  {stats.count > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{stats.count} reserva{stats.count !== 1 ? 's' : ''}</span>
                        <span className="text-foreground font-medium">{fmtMoney(stats.revenue)} total</span>
                      </div>
                      {occ.pct > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${occ.pct >= 80 ? 'bg-emerald-500' : occ.pct >= 50 ? 'bg-amber-400' : 'bg-primary/50'}`}
                              style={{ width: `${occ.pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{occ.occupied}/{occ.total}d</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status */}
                  {active ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-emerald-800">Em casa: {activeGuest?.nome}</span>
                    </div>
                  ) : next ? (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-xs font-medium text-blue-800">
                        Próxima: {nextGuest?.nome} · {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(next.check_in + 'T00:00:00'))}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                      <span className="text-xs text-gray-500">Disponível</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
