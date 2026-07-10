'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  BedDouble, Bath, Users, MapPin,
  Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees,
  CheckCircle2,
} from 'lucide-react'
import { uuid, fmtMoney, nights as calcNights } from '@/lib/utils'
import { addDays, calculatePriceWithRules } from '@/lib/reservations'
import type { Property, WebsiteSettings, PriceRule, Tarifa, PlatformRate } from '@/lib/types'
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

// ─── Booking Calendar ─────────────────────────────────────────────────────────

interface CalendarProps {
  blocked: Set<string>
  sortedBlocked: string[]
  minDate: string
  checkIn: string | null
  checkOut: string | null
  rangeError: boolean
  onSelect: (date: string) => void
}

function BookingCalendar({ blocked, sortedBlocked, minDate, checkIn, checkOut, rangeError, onSelect }: CalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const grid = useMemo(() => buildGrid(year, month), [year, month])
  const selectingCheckOut = !!(checkIn && !checkOut)

  // First blocked date strictly after checkIn — check-out is valid ON this date
  // but NOT after it (would cross an existing booking)
  const firstBlockedAfterCheckIn = useMemo(() => {
    if (!checkIn) return null
    return sortedBlocked.find(d => d > checkIn) ?? null
  }, [checkIn, sortedBlocked])

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

  function isDisabled(date: string): boolean {
    if (selectingCheckOut) {
      if (date <= checkIn!) return true
      // Disable dates beyond the first blocked date — user can check out ON
      // the blocked date (another guest's check-in) but not past it
      if (firstBlockedAfterCheckIn && date > firstBlockedAfterCheckIn) return true
      return false
    }
    return date < minDate || blocked.has(date)
  }

  // Visual states for calendar cells
  function getCellClass(date: string): string {
    const disabled = isDisabled(date)
    const isCI = date === checkIn
    const isCO = date === checkOut
    const inR = inRange(date)
    const isBooked = blocked.has(date)

    if (isCI || isCO) return 'bg-primary text-primary-foreground rounded-lg font-bold'
    if (inR && isBooked) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-none relative'
    if (inR) return 'bg-primary/10 text-primary rounded-none'
    if (disabled) {
      if (isBooked) return 'text-muted-foreground/20 cursor-not-allowed line-through'
      return 'text-muted-foreground/25 cursor-not-allowed'
    }
    if (isBooked && selectingCheckOut) {
      // Booked dates are enabled as check-out but visually marked
      return 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg cursor-pointer relative'
    }
    return 'hover:bg-muted rounded-lg cursor-pointer text-foreground'
  }

  const selectionPhaseLabel = !checkIn
    ? '👆 Seleciona a data de entrada'
    : !checkOut
    ? '👆 Agora seleciona a data de saída'
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* Phase instruction */}
      {selectionPhaseLabel && (
        <div className="text-center text-sm font-semibold text-primary">
          {selectionPhaseLabel}
        </div>
      )}

      {/* Range error */}
      {rangeError && (
        <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
          Período parcialmente ocupado — escolhe outro intervalo de datas.
        </div>
      )}

      {/* Month navigation */}
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

      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((date, i) => {
          if (!date) return <div key={i} />
          const disabled = isDisabled(date)
          const dayNum = parseInt(date.slice(8))
          const isBooked = blocked.has(date)

          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              onClick={() => onSelect(date)}
              className={[
                'relative h-10 w-full text-xs font-medium transition-colors',
                getCellClass(date),
              ].join(' ')}
              title={disabled && isBooked ? 'Data ocupada' : undefined}
            >
              {dayNum}
              {/* Dot indicator for booked check-out dates */}
              {isBooked && !disabled && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500 dark:bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected range summary */}
      {checkIn && (
        <p className="text-xs text-center text-muted-foreground">
          {checkOut
            ? `${fmtDateShort(checkIn)} → ${fmtDateShort(checkOut)} · ${calcNights(checkIn, checkOut)} noite${calcNights(checkIn, checkOut) !== 1 ? 's' : ''}`
            : `Entrada: ${fmtDateShort(checkIn)} — seleciona a saída`}
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  prop: Property
  settings: WebsiteSettings
  blocked: string[]
  priceRules: PriceRule[]
  tarifas: Tarifa[]
  platformRates: PlatformRate[]
}

export default function BookingClient({ prop, settings, blocked: blockedArr, priceRules, tarifas, platformRates }: Props) {
  const router = useRouter()

  const blockedSet = useMemo(() => new Set(blockedArr), [blockedArr])
  const sortedBlocked = useMemo(() => [...blockedArr].sort(), [blockedArr])

  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState(false)
  const [numHospedes, setNumHospedes] = useState(2)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  // antecedencia_dias = 0 → today is bookable; 1 → earliest is tomorrow
  const minDate = addDays(today, settings.antecedencia_dias ?? 0)
  const numNights = checkIn && checkOut ? calcNights(checkIn, checkOut) : 0
  const minNights = settings.min_noites ?? 1
  const hasEnoughNights = numNights >= minNights

  const pricing = useMemo(() => {
    if (!checkIn || !checkOut || numNights <= 0) return null
    return calculatePriceWithRules(prop, checkIn, checkOut, priceRules, tarifas, platformRates, 'direto')
  }, [prop, checkIn, checkOut, numNights, priceRules, tarifas, platformRates])

  const total = pricing?.total ?? 0
  const canSubmit = checkIn && checkOut && hasEnoughNights && nome.trim() && email.trim()

  function handleDateSelect(date: string) {
    setRangeError(false)

    if (!checkIn || (checkIn && checkOut)) {
      // First click, or resetting: set as check-in
      setCheckIn(date)
      setCheckOut(null)
      return
    }

    // Second click: selecting check-out
    if (date <= checkIn) {
      // Clicked same or earlier date: restart check-in selection
      setCheckIn(date)
      setCheckOut(null)
      return
    }

    // Scan for blocked dates between check-in and chosen check-out (exclusive)
    const hasBlocked = sortedBlocked.some(d => d > checkIn && d < date)

    if (hasBlocked) {
      // Keep the check-in selection; show an error so the user understands
      setRangeError(true)
      return
    }

    setCheckOut(date)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!checkIn || !checkOut || !nome.trim() || !email.trim()) return
    if (numNights < minNights) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const guestId = uuid()
      const bookingId = uuid()
      const bookRes = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: {
            id: guestId,
            nome: nome.trim(),
            email: email.trim(),
            telefone: telefone.trim() || undefined,
            tags: ['novo'],
            notas: notas.trim() || undefined,
            criado_em: new Date().toISOString(),
          },
          booking: {
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
          },
        }),
      })
      if (!bookRes.ok) throw new Error('Erro ao criar reserva')
      // Email de notificação é enviado server-side por /api/book
      router.push(`/book/${prop.id}/confirmacao?b=${bookingId}&nome=${encodeURIComponent(nome)}`)
    } catch {
      setSubmitting(false)
      setSubmitError('Ocorreu um erro ao enviar o pedido. Tenta novamente.')
    }
  }

  const waLink = settings.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de fazer uma reserva em ${prop.nome}.`)}`
    : null

  return (
    <div className="min-h-dvh bg-background flex flex-col">

      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href={prop.parent_id ? `/book/${prop.parent_id}` : '/book'}
          className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-semibold text-sm truncate flex-1">{prop.nome}</span>
        {checkIn && checkOut && hasEnoughNights && (
          <span className="text-sm font-bold text-primary shrink-0">{fmtMoney(total)}</span>
        )}
      </header>

      {prop.imagem_url ? (
        <div className="relative h-72 lg:h-96 overflow-hidden bg-muted">
          <Image src={prop.imagem_url} alt={prop.nome} fill sizes="(max-width: 1024px) 100vw, 1024px" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="h-3 w-full" style={{ backgroundColor: prop.cor }} />
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8 pb-24">

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-7">

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Escolha as datas</p>
            <div className="rounded-xl border border-border bg-card p-5">
              <BookingCalendar
                blocked={blockedSet}
                sortedBlocked={sortedBlocked}
                minDate={minDate}
                checkIn={checkIn}
                checkOut={checkOut}
                rangeError={rangeError}
                onSelect={handleDateSelect}
              />
            </div>
            {checkIn && checkOut && !hasEnoughNights && (
              <p className="text-xs text-destructive text-center">
                Mínimo de {minNights} noite{minNights !== 1 ? 's' : ''}. Por favor seleciona datas diferentes.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Hóspedes</p>
              <p className="text-xs text-muted-foreground">Máximo {prop.capacidade} pessoa{prop.capacidade !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setNumHospedes(Math.max(1, numHospedes - 1))}
                className="h-11 w-11 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 active:scale-95 transition-all">
                −
              </button>
              <span className="text-sm font-bold w-4 text-center">{numHospedes}</span>
              <button type="button" onClick={() => setNumHospedes(Math.min(prop.capacidade, numHospedes + 1))}
                className="h-11 w-11 rounded-full border border-border flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 active:scale-95 transition-all">
                +
              </button>
            </div>
          </div>

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
