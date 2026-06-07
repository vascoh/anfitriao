'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ArrowRight, AlertTriangle, Plus, Sparkles, LogIn, LogOut, Home, Clock, ShieldCheck, ShieldAlert, Check, Circle } from 'lucide-react'
import { today, fmtDate, fmtMoney, nights } from '@/lib/utils'
import { db } from '@/lib/db'
import { fetchGuests, fetchBookings, fetchProperties } from '@/lib/fetcher'
import type { Booking, Property, Guest, WebsiteSettings } from '@/lib/types'
import { STATUS_LABEL, SOURCE_LABEL, SOURCE_BG, sibaComplete } from '@/lib/labels'

function useTodayLabel() {
  return new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

function guestName(guests: Guest[], id: string | null) {
  return guests.find(g => g.id === id)?.nome ?? '—'
}

function propName(props: Property[], id: string) {
  return props.find(p => p.id === id)?.nome ?? '—'
}

function ArrivalCard({ b, guests, props }: { b: Booking; guests: Guest[]; props: Property[] }) {
  const n = nights(b.check_in, b.check_out)
  const prop = props.find(p => p.id === b.propriedade_id)
  const guest = guests.find(g => g.id === b.hospede_id)
  const sibaOk = guest ? sibaComplete(guest) : false
  return (
    <Link href={`/reservas/${b.id}`}
      className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/50 transition-colors">
      <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{guest?.nome ?? '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{prop?.nome} · {n} noite{n !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_BG[b.origem]}`}>
          {SOURCE_LABEL[b.origem]}
        </span>
        {sibaOk ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <ShieldCheck className="h-3 w-3" /> SIBA
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
            <ShieldAlert className="h-3 w-3" /> SIBA
          </span>
        )}
      </div>
    </Link>
  )
}

function InHouseRow({ b, guests, props }: { b: Booking; guests: Guest[]; props: Property[] }) {
  const prop = props.find(p => p.id === b.propriedade_id)
  const t = today()
  const daysLeft = nights(t, b.check_out)
  return (
    <Link href={`/reservas/${b.id}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-muted/50 transition-colors">
      <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{guestName(guests, b.hospede_id)}</p>
        <p className="text-xs text-muted-foreground truncate">{prop?.nome}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">sai {fmtDate(b.check_out)}</p>
        <p className="text-[10px] text-muted-foreground/70">{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</p>
      </div>
    </Link>
  )
}

export default function HojePage() {
  const { user } = useUser()
  const ownerId = user?.id
  const dateLabel = useTodayLabel()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchBookings(), fetchGuests(), fetchProperties(), db.getWebsiteSettings(ownerId)])
      .then(([b, g, p, s]) => { setBookings(b); setGuests(g); setProps(p); setSettings(s) })
      .finally(() => setLoaded(true))
  }, [ownerId])

  const t = today()

  const chegadas = useMemo(() =>
    bookings.filter(b => b.check_in === t && b.estado !== 'cancelada' && b.estado !== 'no_show'),
    [bookings, t]
  )
  const saidas = useMemo(() =>
    bookings.filter(b => b.check_out === t && (b.estado === 'checkin' || b.estado === 'checkout')),
    [bookings, t]
  )
  const emCasa = useMemo(() =>
    bookings.filter(b => b.estado === 'checkin'),
    [bookings]
  )
  const pendentes = useMemo(() =>
    bookings.filter(b => b.estado === 'pendente'),
    [bookings]
  )
  const pagamentosEmFalta = useMemo(() =>
    bookings.filter(b =>
      b.estado !== 'cancelada' && b.estado !== 'no_show' &&
      b.preco_pago < b.preco_total &&
      b.check_in <= t
    ),
    [bookings, t]
  )

  const esquecidosCheckin = useMemo(() =>
    bookings.filter(b => b.estado === 'confirmada' && b.check_in < t),
    [bookings, t]
  )

  const proximasChegadas = useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 7)
    const horizonStr = horizon.toISOString().slice(0, 10)
    return bookings
      .filter(b => b.check_in >= tomorrowStr && b.check_in <= horizonStr && b.estado !== 'cancelada' && b.estado !== 'no_show')
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
  }, [bookings])

  const activeProps = useMemo(() => props.filter(p => p.ativo), [props])
  const totalUnidades = activeProps.length
  const ocupacao = totalUnidades > 0 ? Math.round((emCasa.length / totalUnidades) * 100) : 0
  const vagas = useMemo(() =>
    activeProps.filter(p => !emCasa.some(b => b.propriedade_id === p.id)),
    [activeProps, emCasa]
  )

  const receitaHoje = useMemo(() =>
    chegadas.reduce((sum, b) => sum + (b.preco_total - b.preco_pago), 0),
    [chegadas]
  )

  const receitaMes = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7)
    return bookings
      .filter(b => b.check_in.startsWith(month) && !['cancelada', 'no_show'].includes(b.estado))
      .reduce((sum, b) => sum + b.preco_total, 0)
  }, [bookings])

  const receitaPrevista = useMemo(() => {
    const todayStr = t
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 28)
    const horizonStr = horizon.toISOString().slice(0, 10)
    return bookings
      .filter(b => (b.estado === 'confirmada' || b.estado === 'checkin') && b.check_in >= todayStr && b.check_in < horizonStr)
      .reduce((sum, b) => sum + b.preco_total, 0)
  }, [bookings, t])

  const temAlertas = pendentes.length > 0 || pagamentosEmFalta.length > 0 || esquecidosCheckin.length > 0
  const diaVazio = chegadas.length === 0 && saidas.length === 0 && emCasa.length === 0 && !temAlertas && proximasChegadas.length === 0 && vagas.length === 0
  const semPropriedades = loaded && props.length === 0

  // Setup checklist — shown when properties exist but config is incomplete
  const setupSteps = useMemo(() => {
    if (!loaded || !settings || props.length === 0) return null
    const hasIcal = props.some(p => p.ical_feeds && p.ical_feeds.length > 0)
    const hasEmail = !!settings.email
    const websiteReady = settings.enabled && hasEmail
    const steps = [
      { done: true, label: 'Propriedade criada', href: '/propriedades' },
      { done: hasEmail, label: 'Email de notificações', href: '/website' },
      { done: websiteReady, label: 'Website público ativo', href: '/website' },
      { done: hasIcal, label: 'Sincronizar Airbnb/Booking (iCal)', href: '/propriedades' },
    ]
    const allDone = steps.every(s => s.done)
    return allDone ? null : steps
  }, [loaded, settings, props])

  return (
    <div className="flex flex-col min-h-full pb-6">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-baseline justify-between gap-2 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
          <span className="text-sm text-muted-foreground capitalize">{dateLabel}</span>
        </div>

        {/* Status strip */}
        <div className="flex items-center border-t border-border divide-x divide-border text-sm max-w-5xl overflow-x-auto">
          <div className="flex items-center gap-2 px-4 lg:px-8 py-2.5 shrink-0">
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{emCasa.length}</span>
            <span className="text-muted-foreground">em casa</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
            <LogIn className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold text-emerald-700">{chegadas.length}</span>
            <span className="text-muted-foreground">chegada{chegadas.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{saidas.length}</span>
            <span className="text-muted-foreground">saída{saidas.length !== 1 ? 's' : ''}</span>
          </div>
          {totalUnidades > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <span className="font-semibold">{ocupacao}%</span>
              <span className="text-muted-foreground">ocupação</span>
            </div>
          )}
          {receitaHoje > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <span className="font-semibold text-emerald-600">{fmtMoney(receitaHoje)}</span>
              <span className="text-muted-foreground">a receber</span>
            </div>
          )}
          {receitaMes > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <span className="font-semibold">{fmtMoney(receitaMes)}</span>
              <span className="text-muted-foreground">este mês</span>
            </div>
          )}
          {receitaPrevista > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <span className="font-semibold text-primary">{fmtMoney(receitaPrevista)}</span>
              <span className="text-muted-foreground">próx. 28d</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-0 max-w-5xl w-full">

        {/* Alertas */}
        {temAlertas && (
          <div className="flex flex-col gap-0 border-b border-border">
            <div className="flex items-center justify-between px-4 lg:px-8 pt-5 pb-2 bg-amber-50/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                <p className="text-xs font-bold uppercase tracking-widest text-amber-900">
                  Atenção
                </p>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 tabular-nums">
                {pendentes.length + pagamentosEmFalta.length + esquecidosCheckin.length} item{pendentes.length + pagamentosEmFalta.length + esquecidosCheckin.length !== 1 ? 's' : ''}
              </span>
            </div>
            {pendentes.map(b => (
              <Link key={b.id} href={`/reservas/${b.id}`}
                className="flex items-start gap-3 bg-amber-50 border-b border-amber-100 px-4 lg:px-8 py-3 active:bg-amber-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">Reserva pendente de confirmação</p>
                  <p className="text-xs text-amber-700 truncate">
                    {guestName(guests, b.hospede_id)} · {propName(props, b.propriedade_id)} · {fmtDate(b.check_in)}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              </Link>
            ))}
            {pagamentosEmFalta.map(b => (
              <Link key={`pay-${b.id}`} href={`/reservas/${b.id}`}
                className="flex items-start gap-3 bg-red-50 border-b border-red-100 px-4 lg:px-8 py-3 active:bg-red-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">Pagamento por receber</p>
                  <p className="text-xs text-destructive/75 truncate">
                    {guestName(guests, b.hospede_id)} · {fmtMoney(b.preco_total - b.preco_pago)} em falta
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              </Link>
            ))}
            {esquecidosCheckin.map(b => (
              <Link key={`late-${b.id}`} href={`/reservas/${b.id}`}
                className="flex items-start gap-3 bg-orange-50 border-b border-orange-100 px-4 lg:px-8 py-3 active:bg-orange-100 transition-colors">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-orange-900">Check-in em atraso</p>
                  <p className="text-xs text-orange-700 truncate">
                    {guestName(guests, b.hospede_id)} · {propName(props, b.propriedade_id)} · entrou {fmtDate(b.check_in)}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Chegadas */}
        {chegadas.length > 0 && (
          <section className="border-b border-border">
            <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
              <LogIn className="h-3.5 w-3.5 text-emerald-600" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chegadas hoje</h2>
            </div>
            <div className="divide-y divide-border">
              {chegadas.map(b => <ArrivalCard key={b.id} b={b} guests={guests} props={props} />)}
            </div>
          </section>
        )}

        {/* Saídas */}
        {saidas.length > 0 && (
          <section className="border-b border-border">
            <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
              <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saídas hoje</h2>
            </div>
            <div className="divide-y divide-border">
              {saidas.map(b => <ArrivalCard key={b.id} b={b} guests={guests} props={props} />)}
            </div>
          </section>
        )}

        {/* Em casa */}
        {emCasa.length > 0 && (
          <section className="border-b border-border">
            <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
              <Home className="h-3.5 w-3.5 text-blue-500" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Em casa agora</h2>
            </div>
            <div className="divide-y divide-border">
              {emCasa.map(b => <InHouseRow key={b.id} b={b} guests={guests} props={props} />)}
            </div>
          </section>
        )}

        {/* Próximas chegadas */}
        {proximasChegadas.length > 0 && (
          <section className="border-b border-border">
            <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Próximos 7 dias</h2>
            </div>
            <div className="divide-y divide-border">
              {proximasChegadas.map(b => {
                const prop = props.find(p => p.id === b.propriedade_id)
                const guest = guests.find(g => g.id === b.hospede_id)
                const n = nights(b.check_in, b.check_out)
                const daysUntil = Math.round((new Date(b.check_in).getTime() - new Date(t).getTime()) / 86400000)
                const checkinDone = b.historico.some(e => e.tipo === 'checkin_online')
                return (
                  <Link key={b.id} href={`/reservas/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-muted/50 transition-colors">
                    <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: prop?.cor ?? 'var(--primary)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{guest?.nome ?? '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{prop?.nome} · {n} noite{n !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-xs font-semibold text-primary">daqui a {daysUntil}d</p>
                      {checkinDone
                        ? <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><ShieldCheck className="h-3 w-3" /> Check-in</span>
                        : <span className="text-[10px] text-amber-600 font-medium">Sem check-in</span>
                      }
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Vagas agora */}
        {vagas.length > 0 && emCasa.length < totalUnidades && totalUnidades > 0 && (
          <section className="border-b border-border">
            <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vagas agora</h2>
            </div>
            <div className="divide-y divide-border">
              {vagas.map(p => {
                const nextBooking = bookings
                  .filter(b => b.propriedade_id === p.id && b.check_in > t && b.estado !== 'cancelada' && b.estado !== 'no_show')
                  .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
                return (
                  <Link key={p.id} href={`/propriedades/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-muted/50 transition-colors">
                    <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.cidade}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {nextBooking ? (
                        <>
                          <p className="text-xs text-muted-foreground">próxima entrada</p>
                          <p className="text-xs font-semibold text-primary">{fmtDate(nextBooking.check_in)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-emerald-600 font-medium">sem reservas</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* First-time onboarding */}
        {semPropriedades && (
          <div className="mx-4 lg:mx-8 my-8 rounded-2xl border border-border bg-card p-6 lg:p-8 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h2 className="text-lg font-bold tracking-tight">Bem-vindo ao Anfitrião</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para começar a gerir reservas, cria a tua primeira propriedade.
                  Demora menos de um minuto.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pl-13">
              <Link href="/propriedades/nova"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
                <Plus className="h-4 w-4" /> Criar primeira propriedade
              </Link>
              <Link href="/website" className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
                Ou configura primeiro o website público →
              </Link>
            </div>
          </div>
        )}

        {/* Empty day (tranquil — has properties but no activity) */}
        {!semPropriedades && diaVazio && loaded && (
          <div className="flex flex-col items-center justify-center gap-2 text-center py-16 px-4">
            <Clock className="h-8 w-8 text-muted-foreground/30 stroke-[1]" />
            <p className="text-base font-medium text-foreground/60">Dia tranquilo</p>
            <p className="text-sm text-muted-foreground">Sem chegadas, saídas ou alertas hoje.</p>
          </div>
        )}

        {/* Setup checklist */}
        {setupSteps && (
          <div className="mx-4 lg:mx-8 my-6 rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <p className="text-sm font-semibold">Próximos passos</p>
                <p className="text-xs text-muted-foreground">
                  {setupSteps.filter(s => s.done).length} de {setupSteps.length} concluídos
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {setupSteps.map((s, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${s.done ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {setupSteps.map((s, i) => (
                <Link key={i} href={s.href}
                  className={`flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg active:bg-muted/40 transition-colors ${s.done ? 'opacity-50' : ''}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                    s.done ? 'bg-primary text-primary-foreground' : 'border-2 border-border bg-card'
                  }`}>
                    {s.done ? <Check className="h-3 w-3 stroke-[3]" /> : <Circle className="h-2 w-2 opacity-0" />}
                  </div>
                  <span className={`text-sm flex-1 ${s.done ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                    {s.label}
                  </span>
                  {!s.done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions (skip when onboarding) */}
        {!semPropriedades && (
          <div className="px-4 lg:px-8 pt-6 pb-2 grid grid-cols-2 gap-2.5">
            <Link href="/reservas/nova"
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40 transition-colors hover:border-border/80">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Nova reserva</span>
            </Link>
            <Link href="/concierge"
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 active:bg-muted/40 transition-colors hover:border-border/80">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Concierge IA</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
