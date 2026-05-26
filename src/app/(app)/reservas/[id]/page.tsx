'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Users, MapPin, Phone, Mail, Edit2,
  CheckCircle2, AlertTriangle, Trash2, Plus, ExternalLink,
  MessageCircle, CreditCard, Check, Link2
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtMoney, nights, uuid } from '@/lib/utils'
import { db } from '@/lib/db'
import { transitionBooking, canTransition, availableActions } from '@/lib/reservations'
import type { Booking, BookingStatus, Guest, Property } from '@/lib/types'
import { STATUS_LABEL, STATUS_CLASS, SOURCE_LABEL, SOURCE_BG, TAG_LABEL, TAG_CLASS } from '@/lib/labels'

function ReminderButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  async function send() {
    setState('sending')
    try {
      const res = await fetch('/api/notify-payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      setState(res.ok ? 'sent' : 'error')
      if (res.ok) setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
    }
  }
  return (
    <button
      onClick={send}
      disabled={state === 'sending' || state === 'sent'}
      className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
        state === 'sent' ? 'bg-emerald-100 text-emerald-700' :
        state === 'error' ? 'bg-red-100 text-red-700' :
        'bg-amber-100 text-amber-700 hover:bg-amber-200'
      }`}
    >
      <Mail className="h-3 w-3" />
      {state === 'sending' ? '...' : state === 'sent' ? 'Enviado' : state === 'error' ? 'Erro' : 'Lembrete'}
    </button>
  )
}

function Stepper({ estado }: { estado: string }) {
  const steps = [
    { key: 'pendente', label: 'Pendente' },
    { key: 'confirmada', label: 'Confirmada' },
    { key: 'checkin', label: 'Em casa' },
    { key: 'checkout', label: 'Concluída' },
  ]
  const currentIdx = steps.findIndex(s => s.key === estado)

  return (
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar py-1">
      {steps.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.key} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                done ? 'border-primary bg-primary' : active ? 'border-primary bg-primary/10' : 'border-border bg-card'
              }`}>
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                ) : active ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${active ? 'font-semibold text-primary' : done ? 'text-primary/70' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 transition-colors ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4">{title}</h2>}
      <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden">{children}</div>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-0 ${className ?? ''}`}>
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

export default function ReservaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [prop, setProp] = useState<Property | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentSaved, setPaymentSaved] = useState(false)
  const [checkinCopied, setCheckinCopied] = useState(false)

  async function load() {
    const [bookings, guestsAll, propsAll] = await Promise.all([
      db.getBookings(), db.getGuests(), db.getProperties()
    ])
    const b = bookings.find(x => x.id === id) ?? null
    setBooking(b)
    if (b) {
      setGuest(guestsAll.find(g => g.id === b.hospede_id) ?? null)
      setProp(propsAll.find(p => p.id === b.propriedade_id) ?? null)
    }
  }

  useEffect(() => { const t = setTimeout(() => { load() }, 0); return () => clearTimeout(t) }, [id])

  async function applyTransition(to: BookingStatus, nota?: string) {
    if (!booking || !canTransition(booking.estado, to)) return
    const updated = transitionBooking(booking, to, nota)
    await db.saveBooking(updated)
    setBooking(updated)
    const TRANSITION_MSG: Partial<Record<BookingStatus, string>> = {
      confirmada: 'Reserva confirmada',
      checkin: 'Check-in registado',
      checkout: 'Check-out registado',
      cancelada: 'Reserva cancelada',
      no_show: 'Marcado como no-show',
    }
    toast.success(TRANSITION_MSG[to] ?? 'Estado atualizado')
    if (to === 'confirmada') {
      fetch('/api/notify-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      }).catch(() => {})
    }
  }

  async function addNote() {
    if (!booking || !note.trim()) return
    const updated: Booking = {
      ...booking,
      notas: note.trim(),
      historico: [...booking.historico, { id: uuid(), data: new Date().toISOString(), tipo: 'nota', descricao: `Nota: ${note.trim()}` }],
    }
    await db.saveBooking(updated)
    setBooking(updated)
    setNote('')
    setShowNote(false)
    toast.success('Nota guardada')
  }

  async function registerPayment() {
    if (!booking) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return
    const newPago = Math.min(booking.preco_pago + amount, booking.preco_total)
    const updated: Booking = {
      ...booking,
      preco_pago: newPago,
      historico: [...booking.historico, {
        id: uuid(),
        data: new Date().toISOString(),
        tipo: 'pagamento',
        descricao: `Pagamento registado: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount)}`,
      }],
    }
    await db.saveBooking(updated)
    setBooking(updated)
    setPaymentAmount('')
    setPaymentSaved(true)
    toast.success(`Pagamento de ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount)} registado`)
    setTimeout(() => { setPaymentSaved(false); setShowPayment(false) }, 1500)
  }

  function openWhatsApp() {
    if (!guest?.telefone || !prop) return
    const n = nights(booking!.check_in, booking!.check_out)
    const checkinDate = fmtDate(booking!.check_in, { weekday: 'long', day: 'numeric', month: 'long' })
    const instrucoes = prop.instrucoes_checkin ? `\n\n${prop.instrucoes_checkin}` : ''
    const checkinLink = `${window.location.origin}/checkin/${booking!.id}`
    const msg = `Olá ${guest.nome}! A sua reserva em ${prop.nome} está confirmada para ${checkinDate} (${n} noite${n !== 1 ? 's' : ''}).${instrucoes}\n\nPor favor, faça o seu check-in online antes da chegada (1 minuto): ${checkinLink}\n\nBem-vindo/a!`
    const phone = guest.telefone.replace(/[^0-9+]/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return }
    if (!booking) return
    await db.deleteBooking(booking.id)
    router.push('/reservas')
  }

  if (!booking) return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 py-4 border-b border-border flex items-center gap-3">
        <Link href="/reservas"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="text-sm text-muted-foreground">Reserva não encontrada</span>
      </header>
    </div>
  )

  const n = nights(booking.check_in, booking.check_out)
  const saldo = booking.preco_total - booking.preco_pago
  const actions = availableActions(booking.estado)

  const PRIMARY_ACTION: Partial<Record<BookingStatus, { label: string; to: BookingStatus }>> = {
    pendente:   { label: 'Confirmar reserva',   to: 'confirmada' },
    confirmada: { label: 'Registar check-in',   to: 'checkin' },
    checkin:    { label: 'Registar check-out',  to: 'checkout' },
  }
  const primaryAction = PRIMARY_ACTION[booking.estado]

  return (
    <div className="flex flex-col min-h-full pb-6">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/reservas" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight truncate">{guest?.nome}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CLASS[booking.estado]}`}>
                {STATUS_LABEL[booking.estado]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{prop?.nome}</p>
          </div>
          <Link href={`/reservas/${id}/editar`} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Edit2 className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-5 py-4">
        {/* Stepper */}
        {booking.estado !== 'cancelada' && booking.estado !== 'no_show' && (
          <div className="px-4">
            <Stepper estado={booking.estado} />
          </div>
        )}

        {/* Primary action */}
        {primaryAction && (
          <div className="px-4 flex flex-col gap-2">
            <button
              onClick={() => applyTransition(primaryAction.to)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm active:opacity-80 transition-opacity"
            >
              {primaryAction.label}
            </button>
            {actions.includes('cancelada') && booking.estado !== 'checkout' && (
              <button
                onClick={() => applyTransition('cancelada')}
                className="w-full border border-destructive/30 text-destructive rounded-xl py-2.5 text-sm font-medium hover:bg-destructive/5 transition-colors"
              >
                Cancelar reserva
              </button>
            )}
            {actions.includes('no_show') && (
              <button
                onClick={() => applyTransition('no_show')}
                className="w-full border border-amber-300/40 text-amber-600 rounded-xl py-2.5 text-sm font-medium hover:bg-amber-50 transition-colors"
              >
                Marcar como no-show
              </button>
            )}
          </div>
        )}

        {/* Alert: saldo */}
        {saldo > 0 && booking.estado !== 'cancelada' && booking.estado !== 'no_show' && (
          <div className="flex items-start gap-3 mx-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Pagamento pendente</p>
              <p className="text-xs text-amber-700">{fmtMoney(saldo)} por receber</p>
            </div>
            {guest?.email && (
              <ReminderButton bookingId={booking.id} />
            )}
          </div>
        )}

        {/* Guest */}
        <Section title="Hóspede">
          {guest?.id ? (
            <Link href={`/hospedes/${guest.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 transition-colors border-b border-border last:border-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-primary">{guest.nome?.[0] ?? '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{guest.nome}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {guest.nacionalidade && <span className="text-xs text-muted-foreground">{guest.nacionalidade}</span>}
                  {guest.tags.map(tag => (
                    <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TAG_CLASS[tag]}`}>
                      {TAG_LABEL[tag]}
                    </span>
                  ))}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-muted-foreground">?</span>
              </div>
              <p className="text-sm text-muted-foreground">Hóspede sem perfil</p>
            </div>
          )}
          {guest?.email && (
            <a href={`mailto:${guest.email}`} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-muted/40">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{guest.email}</span>
            </a>
          )}
          {guest?.telefone && (
            <a href={`tel:${guest.telefone}`} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-muted/40">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{guest.telefone}</span>
            </a>
          )}
          {guest?.telefone && (
            <button onClick={openWhatsApp}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-muted/40 w-full text-left transition-colors hover:bg-muted/30">
              <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm text-emerald-700 font-medium">Enviar mensagem WhatsApp</span>
            </button>
          )}
          {booking.estado !== 'cancelada' && booking.estado !== 'checkout' && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/checkin/${booking.id}`)
                setCheckinCopied(true)
                setTimeout(() => setCheckinCopied(false), 2000)
              }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-muted/40 w-full text-left transition-colors hover:bg-muted/30"
            >
              {checkinCopied
                ? <Check className="h-4 w-4 text-primary shrink-0" />
                : <Link2 className="h-4 w-4 text-primary shrink-0" />
              }
              <span className="text-sm text-primary font-medium">
                {checkinCopied ? 'Link copiado!' : 'Copiar link de check-in online'}
              </span>
            </button>
          )}
        </Section>

        {/* Booking details */}
        <Section title="Reserva">
          <Row label="Check-in" value={fmtDate(booking.check_in, { weekday: 'short', day: 'numeric', month: 'short' })} />
          <Row label="Check-out" value={fmtDate(booking.check_out, { weekday: 'short', day: 'numeric', month: 'short' })} />
          <Row label="Duração" value={`${n} noite${n !== 1 ? 's' : ''}`} />
          <Row label="Hóspedes" value={<span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{booking.num_hospedes}</span>} />
          <Row label="Origem" value={
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_BG[booking.origem]}`}>
              {SOURCE_LABEL[booking.origem]}
            </span>
          } />
        </Section>

        {/* Payment */}
        <Section title="Pagamento">
          <Row label="Total" value={<span className="font-bold">{fmtMoney(booking.preco_total)}</span>} />
          {n > 0 && booking.preco_total > 0 && (
            <Row label="Por noite" value={<span className="text-muted-foreground">{fmtMoney(Math.round(booking.preco_total / n))}</span>} />
          )}
          <Row label="Recebido" value={<span className={booking.preco_pago >= booking.preco_total ? 'text-emerald-600 font-semibold' : ''}>{fmtMoney(booking.preco_pago)}</span>} />
          {saldo > 0 && <Row label="Por receber" value={<span className="text-destructive font-semibold">{fmtMoney(saldo)}</span>} />}
          {saldo > 0 && booking.estado !== 'cancelada' && booking.estado !== 'no_show' && (
            <>
              {!showPayment ? (
                <button onClick={() => { setShowPayment(true); setPaymentAmount(String(saldo)) }}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-medium w-full text-left hover:bg-muted/30 transition-colors">
                  <CreditCard className="h-4 w-4 shrink-0" />
                  Registar pagamento
                </button>
              ) : (
                <div className="px-4 py-3 flex flex-col gap-2 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium">Montante recebido (€)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      max={saldo}
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    <button
                      onClick={registerPayment}
                      disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                      className={`flex items-center gap-1.5 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                        paymentSaved ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {paymentSaved ? <Check className="h-4 w-4" /> : 'Guardar'}
                    </button>
                    <button onClick={() => setShowPayment(false)}
                      className="px-3 rounded-lg border border-border text-sm text-muted-foreground">
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {booking.preco_pago >= booking.preco_total && booking.preco_total > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-xs text-emerald-700 font-medium">Pagamento completo</span>
            </div>
          )}
        </Section>

        {/* Property */}
        <Section title="Propriedade">
          <Link href={`/propriedades/${prop?.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 transition-colors">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: prop?.cor + '20' }}>
              <MapPin className="h-4.5 w-4.5" style={{ color: prop?.cor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{prop?.nome}</p>
              <p className="text-xs text-muted-foreground">{prop?.cidade} · {prop?.capacidade} pax</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>
        </Section>

        {/* Notes */}
        {(booking.notas || showNote) && (
          <Section title="Notas internas">
            {booking.notas && (
              <div className="px-4 py-3.5 border-b border-border last:border-0">
                <p className="text-sm text-foreground/80 leading-relaxed">{booking.notas}</p>
              </div>
            )}
            {showNote && (
              <div className="p-4 flex flex-col gap-2">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Escreve uma nota..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none min-h-20 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={addNote} disabled={!note.trim()} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-40">Guardar</button>
                  <button onClick={() => { setShowNote(false); setNote('') }} className="flex-1 border border-border rounded-lg py-2 text-sm font-medium">Cancelar</button>
                </div>
              </div>
            )}
          </Section>
        )}

        {!showNote && !booking.notas && (
          <button onClick={() => setShowNote(true)} className="flex items-center gap-2 text-sm text-muted-foreground mx-4 py-2">
            <Plus className="h-3.5 w-3.5" /> Adicionar nota
          </button>
        )}
        {!showNote && booking.notas && (
          <button onClick={() => { setNote(booking.notas ?? ''); setShowNote(true) }} className="flex items-center gap-2 text-sm text-muted-foreground mx-4 py-1">
            <Edit2 className="h-3.5 w-3.5" /> Editar nota
          </button>
        )}

        {/* Timeline */}
        <div className="flex flex-col gap-3 px-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Histórico</h2>
          <div className="flex flex-col gap-0 relative">
            <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />
            {[...booking.historico].reverse().map((ev, i) => (
              <div key={ev.id} className="flex items-start gap-3 pb-4 last:pb-0 relative">
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  i === 0 ? 'border-primary bg-primary' : 'border-border bg-card'
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-medium">{ev.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ev.data))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        {booking.estado !== 'checkout' && (
          <div className="px-4 pt-2">
            <button
              onClick={handleDelete}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                confirmDelete
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : 'border-destructive/30 text-destructive hover:bg-destructive/5'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? 'Confirmar eliminação' : 'Eliminar reserva'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
