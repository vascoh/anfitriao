'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft, ChevronRight, Check, Search, Plus } from 'lucide-react'
import { uuid, today, addDays } from '@/lib/utils'
import { fetchGuests, fetchProperties, fetchBookings } from '@/lib/fetcher'
import { detectConflict, calculatePriceWithRules } from '@/lib/reservations'
import type { Property, Guest, Booking, PriceRule, Tarifa, PlatformRate, BookingSource } from '@/lib/types'
import { SOURCE_LABEL } from '@/lib/labels'

type Step = 'propriedade' | 'datas' | 'hospede' | 'detalhes'

const SOURCES: BookingSource[] = ['airbnb', 'booking', 'direto', 'expedia', 'vrbo', 'outro']

function StepHeader({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-4">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">Passo {step} de {total}</p>
      <h2 className="text-lg font-semibold">{label}</h2>
    </div>
  )
}

export default function NovaReservaPage() {
  return (
    <Suspense>
      <NovaReservaInner />
    </Suspense>
  )
}

function NovaReservaInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const ownerId = user?.id
  const [step, setStep] = useState<Step>('propriedade')
  const [properties, setProperties] = useState<Property[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [guestSearch, setGuestSearch] = useState('')
  const [showNewGuest, setShowNewGuest] = useState(false)

  // Form state
  const [propId, setPropId] = useState(() => searchParams.get('propriedade') ?? '')
  const [checkIn, setCheckIn] = useState(() => searchParams.get('checkin') ?? today())
  const [checkOut, setCheckOut] = useState(() => addDays(searchParams.get('checkin') ?? today(), 2))
  const [guestId, setGuestId] = useState('')
  const [newGuestNome, setNewGuestNome] = useState('')
  const [numHospedes, setNumHospedes] = useState(2)
  const [origem, setOrigem] = useState<BookingSource>('direto')
  const [precoTotal, setPrecoTotal] = useState('')
  const [precoPago, setPrecoPago] = useState('')
  const [notas, setNotas] = useState('')
  const [conflito, setConflito] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [priceRules, setPriceRules] = useState<PriceRule[]>([])
  const [priceTarifas, setPriceTarifas] = useState<Tarifa[]>([])
  const [platformRates, setPlatformRates] = useState<PlatformRate[]>([])

  useEffect(() => {
    if (!ownerId) return
    fetchProperties().then(all => {
      const active = all.filter(p => p.ativo)
      setProperties(active)
      const preselected = searchParams.get('propriedade')
      if (preselected && active.some(p => p.id === preselected)) {
        setStep('datas')
      }
    })
    fetchGuests().then(setGuests)
    fetch('/api/price-rules').then(r => r.json()).then(d => setPriceRules(Array.isArray(d) ? d : []))
    fetch('/api/tarifas').then(r => r.json()).then(d => setPriceTarifas(Array.isArray(d) ? d : []))
    fetch('/api/platform-rates').then(r => r.json()).then(d => setPlatformRates(Array.isArray(d) ? d : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch inicial por owner; searchParams só lido no arranque
  }, [ownerId])

  const selectedProp = properties.find(p => p.id === propId)
  const selectedGuest = guests.find(g => g.id === guestId)
  const filteredGuests = guests.filter(g =>
    !guestSearch || g.nome.toLowerCase().includes(guestSearch.toLowerCase())
  )

  // Auto-fill price when reaching details step using rule-based pricing
  useEffect(() => {
    if (step === 'detalhes' && selectedProp && checkIn && checkOut && checkIn < checkOut && !precoTotal) {
      const breakdown = calculatePriceWithRules(selectedProp, checkIn, checkOut, priceRules, priceTarifas, platformRates, origem)
      const t = setTimeout(() => setPrecoTotal(String(breakdown.total)), 0)
      return () => clearTimeout(t)
    }
  }, [step, selectedProp, checkIn, checkOut, priceRules, priceTarifas, platformRates, origem, precoTotal])

  const STEPS: Step[] = ['propriedade', 'datas', 'hospede', 'detalhes']

  function goNext() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  function goBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
    else router.push('/reservas')
  }

  function handleSelectGuest(id: string) {
    setGuestId(id)
    goNext()
  }

  async function handleCreateGuest() {
    if (!newGuestNome.trim()) return
    const g: Guest = {
      id: uuid(),
      nome: newGuestNome.trim(),
      tags: ['novo'],
      criado_em: new Date().toISOString(),
      owner_id: ownerId,
    }
    await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g) })
    setGuests(await fetchGuests())
    setGuestId(g.id)
    setShowNewGuest(false)
    setNewGuestNome('')
    goNext()
  }

  async function handleSubmit() {
    if (!propId || !guestId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const total = parseFloat(precoTotal) || 0
      const pago = parseFloat(precoPago) || 0
      const booking: Booking = {
        id: uuid(),
        propriedade_id: propId,
        hospede_id: guestId,
        check_in: checkIn,
        check_out: checkOut,
        num_hospedes: numHospedes,
        estado: 'confirmada',
        origem,
        preco_total: total,
        preco_pago: Math.min(pago, total),
        notas: notas.trim() || undefined,
        criado_em: new Date().toISOString(),
        historico: [
          { id: uuid(), data: new Date().toISOString(), tipo: 'criada', descricao: 'Reserva criada manualmente' },
          { id: uuid(), data: new Date().toISOString(), tipo: 'confirmada', descricao: 'Confirmada na criação' },
        ],
        owner_id: ownerId,
      }
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking) })
      if (!res.ok) throw new Error('Erro ao guardar reserva')
      router.push(`/reservas/${booking.id}`)
    } catch {
      setSubmitting(false)
      setSubmitError('Erro ao criar reserva. Tenta novamente.')
    }
  }

  return (<div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={goBack} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Nova reserva</h1>
        </div>
      </header>

      {/* Step: Propriedade */}
      {step === 'propriedade' && (
        <div className="flex flex-col flex-1">
          <StepHeader step={1} total={4} label="Qual a propriedade?" />
          <div className="flex flex-col gap-2 px-4">
            {properties.map(p => (
              <button
                key={p.id}
                onClick={() => { setPropId(p.id); goNext() }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  propId === p.id ? 'border-primary bg-primary/5' : 'border-border bg-card active:bg-muted/40'
                }`}
              >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: p.cor + '25' }}>
                  <span className="text-base font-bold" style={{ color: p.cor }}>{p.nome[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.cidade} · max {p.capacidade} pax · €{p.preco_base}/noite</p>
                </div>
                {propId === p.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
            {properties.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Sem propriedades ativas.</p>
                <Link href="/propriedades/nova" className="text-primary text-sm font-medium mt-2 inline-block">Adicionar propriedade</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Datas */}
      {step === 'datas' && (
        <div className="flex flex-col flex-1">
          <StepHeader step={2} total={4} label="Datas da estadia" />
          <div className="flex flex-col gap-4 px-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={today()}
                  onChange={e => {
                    setCheckIn(e.target.value)
                    if (e.target.value >= checkOut) {
                      setCheckOut(addDays(e.target.value, 1))
                    }
                  }}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={e => setCheckOut(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            {selectedProp && checkIn && checkOut && checkIn < checkOut && (() => {
              const bd = calculatePriceWithRules(selectedProp, checkIn, checkOut, priceRules, priceTarifas, platformRates, origem)
              return (
                <div className="rounded-xl border border-border bg-card px-4 py-3.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{bd.num_noites} noite{bd.num_noites !== 1 ? 's' : ''} × €{bd.preco_noite}</span>
                    <span className="text-sm font-medium">€{bd.subtotal_noites}</span>
                  </div>
                  {bd.taxa_limpeza > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de limpeza</span>
                      <span className="text-sm font-medium">€{bd.taxa_limpeza}</span>
                    </div>
                  )}
                  {bd.ajuste_valor !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Ajuste {bd.tarifa_aplicada ?? ''}</span>
                      <span className={`text-sm font-medium ${bd.ajuste_valor < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {bd.ajuste_valor > 0 ? '+' : ''}€{bd.ajuste_valor}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-1.5">
                    <span className="text-sm font-semibold">Total estimado</span>
                    <span className="font-bold text-base">€{bd.total}</span>
                  </div>
                  {bd.regra_aplicada && (
                    <p className="text-[10px] text-primary font-medium">Regra aplicada: {bd.regra_aplicada}</p>
                  )}
                </div>
              )
            })()}
            {conflito && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive font-medium">
                Conflito de datas: já existe uma reserva neste período para esta propriedade.
              </div>
            )}
            <button
              onClick={async () => {
                if (!checkIn || !checkOut || checkIn >= checkOut) return
                if (propId) {
                  const bookings = await fetchBookings()
                  const conflict = detectConflict(bookings, propId, checkIn, checkOut)
                  if (conflict) { setConflito(true); return }
                }
                setConflito(false)
                goNext()
              }}
              disabled={!checkIn || !checkOut || checkIn >= checkOut}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step: Hóspede */}
      {step === 'hospede' && (
        <div className="flex flex-col flex-1">
          <StepHeader step={3} total={4} label="Quem é o hóspede?" />
          <div className="flex flex-col flex-1 px-4 gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="search"
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                placeholder="Pesquisar hóspede..."
                className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            {showNewGuest ? (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <p className="text-sm font-semibold">Novo hóspede</p>
                <input
                  type="text"
                  value={newGuestNome}
                  onChange={e => setNewGuestNome(e.target.value)}
                  placeholder="Nome completo"
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateGuest} disabled={!newGuestNome.trim()} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-40">
                    Criar e continuar
                  </button>
                  <button onClick={() => setShowNewGuest(false)} className="flex-1 border border-border rounded-lg py-2 text-sm font-medium">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewGuest(true)}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-left active:bg-muted/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">Criar novo hóspede</span>
              </button>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {filteredGuests.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum hóspede encontrado</div>
              ) : (
                filteredGuests.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleSelectGuest(g.id)}
                    className="flex items-center gap-3 w-full px-4 py-3.5 text-left border-b border-border last:border-0 active:bg-muted/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{g.nome[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.nome}</p>
                      {g.nacionalidade && <p className="text-xs text-muted-foreground">{g.nacionalidade}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step: Detalhes */}
      {step === 'detalhes' && (
        <div className="flex flex-col flex-1">
          <StepHeader step={4} total={4} label="Detalhes finais" />
          <div className="flex flex-col gap-4 px-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted-foreground">Propriedade</p>
                <p className="text-sm font-semibold mt-0.5">{selectedProp?.nome}</p>
              </div>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted-foreground">Hóspede</p>
                <p className="text-sm font-semibold mt-0.5">{selectedGuest?.nome}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="text-sm font-semibold mt-0.5">
                  {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(checkIn + 'T00:00:00'))} →{' '}
                  {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(checkOut + 'T00:00:00'))}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Nº de hóspedes</label>
                <input type="number" min={1} max={selectedProp?.capacidade ?? 20} value={numHospedes}
                  onChange={e => setNumHospedes(Number(e.target.value))}
                  className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-28" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Origem</label>
                <div className="flex gap-2 flex-wrap">
                  {SOURCES.map(s => (
                    <button key={s} onClick={() => setOrigem(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        origem === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                      {SOURCE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs text-muted-foreground font-medium">Total (€)</label>
                  <input type="number" min={0} value={precoTotal}
                    onChange={e => setPrecoTotal(e.target.value)}
                    placeholder="0"
                    className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs text-muted-foreground font-medium">Recebido (€)</label>
                  <input type="number" min={0} value={precoPago}
                    onChange={e => setPrecoPago(e.target.value)}
                    placeholder="0"
                    className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">Notas (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Pedidos especiais, informações adicionais..."
                  className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-20 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-destructive text-center">{submitError}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!propId || !guestId || !checkIn || !checkOut || submitting}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity"
            >
              {submitting ? 'A criar reserva...' : 'Criar reserva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
