'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, BedDouble, Bath, Users, MapPin, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees, CheckCircle2 } from 'lucide-react'
import { uuid, fmtMoney, nights as calcNights } from '@/lib/store'
import { db } from '@/lib/db'
import { blockedDates, addDays, calculatePriceWithRules } from '@/lib/reservations'
import type { Property, WebsiteSettings, PriceRule, Tarifa, PlatformRate, PricingBreakdown } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const AMENITY_ICON: Record<string, React.ReactNode> = {
  wifi:            <Wifi className="h-4 w-4" />,
  ar_condicionado: <Wind className="h-4 w-4" />,
  estacionamento:  <Car className="h-4 w-4" />,
  piscina:         <Waves className="h-4 w-4" />,
  cozinha:         <UtensilsCrossed className="h-4 w-4" />,
  maquina_lavar:   <WashingMachine className="h-4 w-4" />,
  tv:              <Tv className="h-4 w-4" />,
  jardim:          <Trees className="h-4 w-4" />,
}

const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Wi-Fi', ar_condicionado: 'Ar condicionado', estacionamento: 'Estacionamento',
  piscina: 'Piscina', cozinha: 'Cozinha equipada', maquina_lavar: 'Máquina de lavar',
  secador: 'Secador', tv: 'TV', varanda: 'Varanda', jardim: 'Jardim',
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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

const WA_ICON = (
  <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

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

function BookingCalendar({ blocked, minDate, checkIn, checkOut, onSelect }: CalendarProps) {
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{MONTHS[month]} {year}</span>
        <button type="button" onClick={nextMonth}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wider">{d}</div>
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
            <button type="button" key={date} disabled={disabled} onClick={() => onSelect(date)}
              className={[
                'h-10 w-full text-xs font-medium transition-colors',
                isCheckIn || isCheckOut
                  ? 'bg-primary text-primary-foreground rounded-lg'
                  : inR
                  ? 'bg-primary/12 text-primary rounded-none'
                  : disabled
                  ? 'text-muted-foreground/30 cursor-not-allowed line-through'
                  : 'hover:bg-muted rounded-lg cursor-pointer',
              ].join(' ')}>
              {dayNum}
            </button>
          )
        })}
      </div>

      {checkIn && (
        <p className="text-xs text-center text-muted-foreground">
          {checkOut
            ? `${fmtDateShort(checkIn)} → ${fmtDateShort(checkOut)} · ${calcNights(checkIn, checkOut)} noites`
            : `Entrada: ${fmtDateShort(checkIn)} — seleciona saída`}
        </p>
      )}
    </div>
  )
}


export default function BookPropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [platformRates, setPlatformRates] = useState<PlatformRate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [numHospedes, setNumHospedes] = useState(2)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function loadData() {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      db.getProperties(),
      db.getWebsiteSettings(),
      db.getBookings(),
      db.getPriceRules(),
      db.getTarifas(),
      db.getPlatformRates(),
    ]).then(([props, ws, bookings, rules, tars, rates]) => {
      const p = props.find(x => x.id === propertyId) ?? null
      setProp(p)
      setSettings(ws)
      setPriceRules(rules)
      setTarifas(tars)
      setPlatformRates(rates)
      if (p) setBlocked(blockedDates(bookings, p.id))
    }).catch((err) => {
      console.error('[loadData error]', err)
      setLoadError(true)
    }).finally(() => {
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [propertyId])

  const today = new Date().toISOString().slice(0, 10)
  const minDate = settings ? addDays(today, settings.antecedencia_dias) : today
  const numNights = checkIn && checkOut ? calcNights(checkIn, checkOut) : 0
  const minNights = settings?.min_noites ?? 1
  const hasEnoughNights = numNights >= minNights

  const pricing: PricingBreakdown | null = useMemo(() => {
    if (!prop || !checkIn || !checkOut || numNights <= 0) return null
    return calculatePriceWithRules(prop, checkIn, checkOut, priceRules, tarifas, platformRates, 'direto')
  }, [prop, checkIn, checkOut, numNights, priceRules, tarifas, platformRates])

  const total = pricing?.total ?? 0
  const canSubmit = checkIn && checkOut && hasEnoughNights && nome.trim() && email.trim()

  function handleDateSelect(date: string) {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date)
      setCheckOut(null)
    } else {
      if (date <= checkIn) { setCheckIn(date); setCheckOut(null); return }
      let cur = addDays(checkIn, 1)
      let hasBlocked = false
      while (cur < date) {
        if (blocked.has(cur)) { hasBlocked = true; break }
        cur = addDays(cur, 1)
      }
      if (hasBlocked) { setCheckIn(date); setCheckOut(null) }
      else setCheckOut(date)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prop || !checkIn || !checkOut || !nome.trim() || !email.trim()) return
    if (numNights < minNights) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const guestId = uuid()
      const bookingId = uuid()
      await db.saveGuest({
        id: guestId,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || undefined,
        tags: ['novo'],
        notas: notas.trim() || undefined,
        criado_em: new Date().toISOString(),
      })
      await db.saveBooking({
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
      // Fire-and-forget — email failure must not block the booking confirmation
      fetch('/api/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          guestName: nome.trim(),
          guestEmail: email.trim(),
          guestPhone: telefone.trim() || null,
          propertyName: prop.nome,
          checkIn,
          checkOut,
          numHospedes,
          total,
          notas: notas.trim() || null,
        }),
      }).catch(() => {})
      router.push(`/book/${propertyId}/confirmacao?b=${bookingId}&nome=${encodeURIComponent(nome)}`)
    } catch {
      setSubmitting(false)
      setSubmitError('Ocorreu um erro ao enviar o pedido. Tenta novamente.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <Link href="/book" className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        </header>
        <div className="h-72 bg-muted animate-pulse" />
        <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-px bg-border" />
          <div className="h-72 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 text-center bg-background">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <ArrowLeft className="h-6 w-6 text-destructive rotate-45 opacity-60" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Erro ao carregar</p>
          <p className="text-sm text-muted-foreground">Não foi possível carregar os dados. Verifica a ligação e tenta novamente.</p>
        </div>
        <button onClick={loadData} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
          Tentar novamente
        </button>
        <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground">← Voltar aos alojamentos</Link>
      </div>
    )
  }

  if (!settings?.enabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Website não disponível.</p>
      </div>
    )
  }

  if (!prop) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Este alojamento não está disponível.</p>
        <Link href="/book" className="text-sm text-primary hover:underline">← Ver todos os alojamentos</Link>
      </div>
    )
  }

  const waLink = settings.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de fazer uma reserva em ${prop.nome}.`)}`
    : null

  return (
    <div className="min-h-dvh bg-background flex flex-col">

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/book" className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-semibold text-sm truncate flex-1">{prop.nome}</span>
        {checkIn && checkOut && hasEnoughNights && (
          <span className="text-sm font-bold text-primary shrink-0">{fmtMoney(total)}</span>
        )}
      </header>

      {/* Cinematic hero */}
      {prop.imagem_url ? (
        <div className="relative h-72 lg:h-96 overflow-hidden bg-muted">
          <img src={prop.imagem_url} alt={prop.nome} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="h-3 w-full" style={{ backgroundColor: prop.cor }} />
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8 pb-24">

        {/* Property overview */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-2xl lg:text-3xl leading-tight">{prop.nome}</h1>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{PROPERTY_TYPE_LABEL[prop.tipo]} · {prop.cidade}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-primary leading-none">
                {fmtMoney(pricing?.preco_noite ?? prop.preco_base)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">por noite</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            {prop.quartos > 0 && (
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" />
                {prop.quartos} quarto{prop.quartos !== 1 ? 's' : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Bath className="h-4 w-4" />
              {prop.casasBanho} WC
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Máx. {prop.capacidade}
            </span>
          </div>

          {prop.descricao && (
            <p className="text-sm text-muted-foreground leading-relaxed">{prop.descricao}</p>
          )}
        </div>

        {/* Amenities */}
        {prop.comodidades.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comodidades</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {prop.comodidades.map(a => (
                <div key={a} className="flex items-center gap-2.5 text-sm">
                  <span className="text-muted-foreground/70 shrink-0">
                    {AMENITY_ICON[a] ?? <span className="h-4 w-4 block" />}
                  </span>
                  <span>{AMENITY_LABEL[a] ?? a.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-border" />

        {/* Booking form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">

          {/* Date picker */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Escolha as datas</p>
            <div className="rounded-xl border border-border bg-card p-5">
              <BookingCalendar blocked={blocked} minDate={minDate} checkIn={checkIn} checkOut={checkOut} onSelect={handleDateSelect} />
            </div>
            {checkIn && checkOut && !hasEnoughNights && (
              <p className="text-xs text-destructive text-center">
                Mínimo de {minNights} noite{minNights !== 1 ? 's' : ''}. Por favor seleciona datas diferentes.
              </p>
            )}
          </div>

          {/* Guests */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Hóspedes</p>
              <p className="text-xs text-muted-foreground">Máximo {prop.capacidade} pessoa{prop.capacidade !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setNumHospedes(Math.max(1, numHospedes - 1))}
                className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                −
              </button>
              <span className="text-sm font-bold w-4 text-center">{numHospedes}</span>
              <button type="button" onClick={() => setNumHospedes(Math.min(prop.capacidade, numHospedes + 1))}
                className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                +
              </button>
            </div>
          </div>

          {/* Guest info */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Os seus dados</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Nome completo', req: true, value: nome, set: setNome, type: 'text', placeholder: 'João Silva' },
                { label: 'Email', req: true, value: email, set: setEmail, type: 'email', placeholder: 'joao@exemplo.com' },
                { label: 'Telefone / WhatsApp', req: false, value: telefone, set: setTelefone, type: 'tel', placeholder: '+351 912 345 678' },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {f.label}{f.req ? <span className="text-primary ml-0.5">*</span> : ''}
                  </label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notas / pedidos especiais</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Hora de chegada prevista, pedidos especiais..."
                  className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Price summary */}
          {checkIn && checkOut && hasEnoughNights && pricing && (
            <div className="rounded-xl bg-muted/50 border border-border p-4 flex flex-col gap-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {fmtMoney(pricing.preco_noite)} × {numNights} noite{numNights !== 1 ? 's' : ''}
                  {pricing.regra_aplicada && (
                    <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {pricing.regra_aplicada}
                    </span>
                  )}
                </span>
                <span className="font-medium">{fmtMoney(pricing.subtotal_noites)}</span>
              </div>
              {pricing.taxa_limpeza > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de limpeza</span>
                  <span className="font-medium">{fmtMoney(pricing.taxa_limpeza)}</span>
                </div>
              )}
              {pricing.ajuste_valor !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {pricing.tarifa_aplicada ?? 'Ajuste'}
                    {pricing.ajuste_pct !== 0 && ` (${pricing.ajuste_pct > 0 ? '+' : ''}${pricing.ajuste_pct}%)`}
                  </span>
                  <span className={`font-medium ${pricing.ajuste_valor < 0 ? 'text-emerald-600' : ''}`}>
                    {pricing.ajuste_valor < 0 ? '-' : '+'}{fmtMoney(Math.abs(pricing.ajuste_valor))}
                  </span>
                </div>
              )}
              {pricing.plataforma_ajuste !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem plataforma</span>
                  <span className="font-medium">{fmtMoney(pricing.plataforma_ajuste)}</span>
                </div>
              )}
              <div className="h-px bg-border/60 my-0.5" />
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold">Total estimado</span>
                <span className="text-primary text-xl font-bold">{fmtMoney(total)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sem taxas de serviço · Pagamento acordado diretamente com o anfitrião.
              </p>
            </div>
          )}

          {/* Validation checklist when not ready */}
          {!canSubmit && (
            <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">Para continuar, precisa de:</p>
              {!checkIn && <p className="text-xs text-muted-foreground">· Selecionar data de entrada no calendário</p>}
              {checkIn && !checkOut && <p className="text-xs text-muted-foreground">· Selecionar data de saída no calendário</p>}
              {checkIn && checkOut && !hasEnoughNights && (
                <p className="text-xs text-muted-foreground">· Selecionar pelo menos {minNights} noite{minNights !== 1 ? 's' : ''}</p>
              )}
              {!nome.trim() && <p className="text-xs text-muted-foreground">· Preencher o nome</p>}
              {!email.trim() && <p className="text-xs text-muted-foreground">· Preencher o email</p>}
            </div>
          )}

          {submitError && (
            <p className="text-xs text-destructive text-center">{submitError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-bold text-sm disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-2">
            {submitting ? (
              'A enviar pedido...'
            ) : canSubmit ? (
              <><CheckCircle2 className="h-4 w-4" /> Enviar pedido de reserva</>
            ) : (
              'Enviar pedido de reserva'
            )}
          </button>

          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/5 transition-colors">
              {WA_ICON}
              Reservar via WhatsApp
            </a>
          )}
        </form>

        {/* House rules */}
        {prop.regras_casa && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Regras da casa</p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{prop.regras_casa}</p>
          </div>
        )}
      </div>
    </div>
  )
}

