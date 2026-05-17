'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, CheckCircle2, Clock, Users, Home, Plus, Sparkles } from 'lucide-react'
import { store, today, fmtDate, fmtMoney, nights } from '@/lib/store'
import type { Booking, Property, Guest } from '@/lib/types'
import { STATUS_LABEL, SOURCE_LABEL, SOURCE_BG } from '@/lib/labels'

function useTodayLabel() {
  return new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

function BookingCard({ b, guests, props }: { b: Booking; guests: Guest[]; props: Property[] }) {
  const guest = guests.find(g => g.id === b.hospede_id)
  const prop = props.find(p => p.id === b.propriedade_id)
  const n = nights(b.check_in, b.check_out)

  return (
    <Link href={`/reservas/${b.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{guest?.nome ?? '—'}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{prop?.nome}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_BG[b.origem]}`}>
            {SOURCE_LABEL[b.origem]}
          </span>
          <span className="text-xs text-muted-foreground">{n} noite{n !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold">{fmtMoney(b.preco_total)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </Link>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold tracking-tight ${color ?? ''}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

export default function HojePage() {
  const dateLabel = useTodayLabel()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [props, setProps] = useState<Property[]>([])

  useEffect(() => {
    setBookings(store.getBookings())
    setGuests(store.getGuests())
    setProps(store.getProperties())
  }, [])

  const t = today()

  const chegadas = bookings.filter(b => b.check_in === t && b.estado !== 'cancelada' && b.estado !== 'no_show')
  const saidas = bookings.filter(b => b.check_out === t && (b.estado === 'checkin' || b.estado === 'checkout'))
  const emCasa = bookings.filter(b => b.estado === 'checkin')
  const pendentes = bookings.filter(b => b.estado === 'pendente')
  const pagamentosPendentes = bookings.filter(b =>
    b.estado !== 'cancelada' && b.estado !== 'no_show' && b.preco_pago < b.preco_total &&
    new Date(b.check_in) <= new Date()
  )
  const totalUnidades = props.filter(p => p.ativo).length
  const ocupadas = emCasa.length
  const ocupacao = totalUnidades > 0 ? Math.round((ocupadas / totalUnidades) * 100) : 0

  return (
    <div className="flex flex-col min-h-full pb-4">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 lg:px-8 py-4 border-b border-border">
        <div className="flex items-baseline justify-between gap-2 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
          <span className="text-sm text-muted-foreground capitalize truncate">{dateLabel}</span>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4 lg:p-8 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard label="Em casa" value={emCasa.length} sub={`de ${totalUnidades} unidades`} />
          <StatCard label="Ocupação" value={`${ocupacao}%`} sub={`${ocupadas}/${totalUnidades} propriedades`} color={ocupacao >= 80 ? 'text-emerald-600' : ''} />
          <StatCard label="Chegadas" value={chegadas.length} sub="hoje" />
          <StatCard label="Saídas" value={saidas.length} sub="hoje" />
        </div>

        {/* Alerts */}
        {(pendentes.length > 0 || pagamentosPendentes.length > 0) && (
          <div className="flex flex-col gap-2">
            {pendentes.map(b => {
              const g = guests.find(x => x.id === b.hospede_id)
              const p = props.find(x => x.id === b.propriedade_id)
              return (
                <Link key={b.id} href={`/reservas/${b.id}`}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 active:bg-amber-100 transition-colors">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">Reserva pendente</p>
                    <p className="text-xs text-amber-700 truncate">{g?.nome} · {p?.nome} · {fmtDate(b.check_in)}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                </Link>
              )
            })}
            {pagamentosPendentes.map(b => {
              const g = guests.find(x => x.id === b.hospede_id)
              const em = b.preco_total - b.preco_pago
              return (
                <Link key={`pay-${b.id}`} href={`/reservas/${b.id}`}
                  className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 active:bg-destructive/10 transition-colors">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-destructive">Pagamento em falta</p>
                    <p className="text-xs text-destructive/80 truncate">{g?.nome} · {fmtMoney(em)} por receber</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        {/* Chegadas */}
        {chegadas.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chegadas hoje</h2>
            </div>
            {chegadas.map(b => <BookingCard key={b.id} b={b} guests={guests} props={props} />)}
          </section>
        )}

        {/* Saídas */}
        {saidas.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saídas hoje</h2>
            </div>
            {saidas.map(b => <BookingCard key={b.id} b={b} guests={guests} props={props} />)}
          </section>
        )}

        {/* Em casa */}
        {emCasa.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Em casa agora</h2>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {emCasa.map(b => {
                const g = guests.find(x => x.id === b.hospede_id)
                const p = props.find(x => x.id === b.propriedade_id)
                return (
                  <Link key={b.id} href={`/reservas/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-muted/40 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{g?.nome?.[0] ?? '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g?.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{p?.nome} · sai {fmtDate(b.check_out)}</p>
                    </div>
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{b.num_hospedes}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {chegadas.length === 0 && saidas.length === 0 && emCasa.length === 0 && pendentes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-12">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 stroke-[1]" />
            <p className="text-base font-medium text-foreground/60">Dia tranquilo</p>
            <p className="text-sm text-muted-foreground">Sem chegadas, saídas ou alertas hoje.</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Link href="/reservas/nova"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40 transition-colors">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Nova reserva</span>
          </Link>
          <Link href="/concierge"
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40 transition-colors">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Concierge IA</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
