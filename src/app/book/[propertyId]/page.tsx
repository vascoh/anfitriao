'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, BedDouble, Bath, Users, MapPin } from 'lucide-react'
import { store, uuid, fmtMoney, nights as calcNights } from '@/lib/store'
import type { Property, WebsiteSettings } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const days: (string | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(isoDate(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function fmtDateShort(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'))
}

interface CalendarProps {
  blocked: Set<string>
  minDate: string
  checkIn: string | null
  checkOut: string | null
  onSelect: (date: string) => void
}

function Calendar({ blocked, minDate, checkIn, checkOut, onSelect }: CalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const grid = useMemo(() => buildGrid(year, month), [year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  function inRange(date: string) {
    if (!checkIn || !checkOut) return false
    return date > checkIn && date < checkOut
  }

  function isDisabled(date: string) {
    return date < minDate || blocked.has(date)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((date, i) => {
          if (!date) return <div key={i} />
          const disabled = isDisabled(date)
          const isCheckIn = date === checkIn
          const isCheckOut = date === checkOut
          const inR = inRange(date)
          const dayNum = parseInt(date.slice(8))

          return (
            <button key={date} disabled={disabled} onClick={() => onSelect(date)}
              className={`h-9 w-full rounded-lg text-xs font-medium transition-colors relative
                ${disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-primary/10 hover:text-primary cursor-pointer'}
                ${isCheckIn || isCheckOut ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}
                ${inR ? 'bg-primary/15 text-primary rounded-none' : ''}
              `}>
              {dayNum}
            </button>
          )
        })}
      </div>

      {checkIn && (
        <p className="text-xs text-center text-muted-foreground">
          {checkOut
            ? `${fmtDateShort(checkIn)} → ${fmtDateShort(checkOut)} · ${calcNights(checkIn, checkOut)} noites`
            : `Check-in: ${fmtDateShort(checkIn)} — Seleciona check-out`}
        </p>
      )}
    </div>
  )
}

export default function BookPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params)
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())

  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [numHospedes, setNumHospedes] = useState(2)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const p = store.getProperties().find(x => x.id === propertyId) ?? null
    setProp(p)
    const ws = store.getWebsiteSettings()
    setSettings(ws)

    const bookings = store.getBookings().filter(b =>
      b.propriedade_id === propertyId &&
      b.estado !== 'cancelada' && b.estado !== 'no_show'
    )
    const dates = new Set<string>()
    bookings.forEach(b => {
      let cur = b.check_in
      while (cur < b.check_out) {
        dates.add(cur)
        cur = addDays(cur, 1)
      }
    })
    setBlocked(dates)
  }, [propertyId])

  const today = new Date().toISOString().slice(0, 10)
  const minDate = settings ? addDays(today, settings.antecedencia_dias) : today
  const numNights = checkIn && checkOut ? calcNights(checkIn, checkOut) : 0
  const total = prop ? numNights * prop.preco_base : 0

  function handleDateSelect(date: string) {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date)
      setCheckOut(null)
    } else {
      if (date <= checkIn) {
        setCheckIn(date)
        setCheckOut(null)
        return
      }
      // Check no blocked dates in range
      let cur = addDays(checkIn, 1)
      let hasBlocked = false
      while (cur < date) {
        if (blocked.has(cur)) { hasBlocked = true; break }
        cur = addDays(cur, 1)
      }
      if (hasBlocked) {
        setCheckIn(date)
        setCheckOut(null)
      } else {
        setCheckOut(date)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prop || !checkIn || !checkOut || !nome.trim() || !email.trim()) return
    if (numNights < (settings?.min_noites ?? 1)) return

    setSubmitting(true)

    const guestId = uuid()
    const bookingId = uuid()

    store.saveGuest({
      id: guestId,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim() || undefined,
      tags: ['novo'],
      notas: notas.trim() || undefined,
      criado_em: new Date().toISOString(),
    })

    store.saveBooking({
      id: bookingId,
      propriedade_id: prop.id,
      hospede_id: guestId,
      check_in: checkIn,
      check_out: checkOut,
      num_hospedes: numHospedes,
      estado: 'pendente',
      origem: 'direto',
      preco_total: total,
      preco_pago: 0,
      notas: notas.trim() || undefined,
      criado_em: new Date().toISOString(),
      historico: [{
        id: uuid(),
        data: new Date().toISOString(),
        tipo: 'criada',
        descricao: 'Reserva criada via website direto',
      }],
    })

    router.push(`/book/${propertyId}/confirmacao?b=${bookingId}&nome=${encodeURIComponent(nome)}`)
  }

  const minNights = settings?.min_noites ?? 1
  const hasEnoughNights = numNights >= minNights
  const canSubmit = checkIn && checkOut && hasEnoughNights && nome.trim() && email.trim()

  if (!prop || !settings) return null
  if (!settings.enabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Website não disponível.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/book" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold text-base truncate flex-1">{prop.nome}</h1>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6 pb-12">
        {/* Property summary */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-2" style={{ backgroundColor: prop.cor }} />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-base">{prop.nome}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" />
                  <span>{PROPERTY_TYPE_LABEL[prop.tipo]} · {prop.cidade}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-primary">{fmtMoney(prop.preco_base)}</p>
                <p className="text-xs text-muted-foreground">por noite</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{prop.quartos} quartos</span>
              <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{prop.casasBanho} casa{prop.casasBanho !== 1 ? 's' : ''} de banho</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Máx. {prop.capacidade}</span>
            </div>
            {prop.comodidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {prop.comodidades.map(a => (
                  <span key={a} className="text-[11px] bg-muted/60 text-foreground/60 px-2 py-0.5 rounded-full">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Calendar */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Datas</p>
            <div className="rounded-xl border border-border bg-card p-4">
              <Calendar
                blocked={blocked}
                minDate={minDate}
                checkIn={checkIn}
                checkOut={checkOut}
                onSelect={handleDateSelect}
              />
            </div>
            {checkIn && checkOut && !hasEnoughNights && (
              <p className="text-xs text-destructive text-center">
                Mínimo de {minNights} noites. Por favor seleciona datas diferentes.
              </p>
            )}
          </div>

          {/* Guests */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Hóspedes</p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm font-medium">Número de hóspedes</span>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setNumHospedes(Math.max(1, numHospedes - 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  −
                </button>
                <span className="text-sm font-semibold w-4 text-center">{numHospedes}</span>
                <button type="button" onClick={() => setNumHospedes(Math.min(prop.capacidade, numHospedes + 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Guest info */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Os seus dados</p>
            {[
              { label: 'Nome completo *', value: nome, set: setNome, type: 'text', placeholder: 'João Silva' },
              { label: 'Email *', value: email, set: setEmail, type: 'email', placeholder: 'joao@exemplo.com' },
              { label: 'Telefone', value: telefone, set: setTelefone, type: 'tel', placeholder: '+351 912 345 678' },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Notas / pedidos especiais</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Hora de chegada prevista, pedidos especiais..."
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Price summary */}
          {checkIn && checkOut && hasEnoughNights && (
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Resumo</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{fmtMoney(prop.preco_base)} × {numNights} noites</span>
                <span className="font-medium">{fmtMoney(total)}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Total estimado</span>
                <span className="text-primary text-lg">{fmtMoney(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O pagamento será acordado diretamente com o anfitrião após confirmação.
              </p>
            </div>
          )}

          <button type="submit" disabled={!canSubmit || submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-bold text-sm disabled:opacity-40 active:opacity-80 transition-opacity">
            {submitting ? 'A enviar pedido...' : 'Enviar pedido de reserva'}
          </button>

          {settings.telefone && (
            <p className="text-center text-xs text-muted-foreground">
              Prefere reservar por WhatsApp?{' '}
              <a href={`https://wa.me/${settings.telefone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="text-primary font-medium">
                Fale connosco
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
