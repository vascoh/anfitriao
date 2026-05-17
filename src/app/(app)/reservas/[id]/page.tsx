'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Users, Calendar, MapPin, Phone, Mail, Edit2,
  CheckCircle2, Circle, AlertTriangle, Trash2, Plus, ExternalLink
} from 'lucide-react'
import { store, fmtDate, fmtMoney, nights, today, uuid } from '@/lib/store'
import type { Booking, Guest, Property } from '@/lib/types'
import { STATUS_LABEL, STATUS_CLASS, SOURCE_LABEL, SOURCE_BG, TAG_LABEL, TAG_CLASS } from '@/lib/labels'

const STATUS_ORDER = ['pendente', 'confirmada', 'checkin', 'checkout'] as const

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

export default function ReservaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [prop, setProp] = useState<Property | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function load() {
    const b = store.getBookings().find(x => x.id === id) ?? null
    setBooking(b)
    if (b) {
      setGuest(store.getGuests().find(g => g.id === b.hospede_id) ?? null)
      setProp(store.getProperties().find(p => p.id === b.propriedade_id) ?? null)
    }
  }

  useEffect(() => { load() }, [id])

  function advance() {
    if (!booking) return
    const idx = STATUS_ORDER.indexOf(booking.estado as typeof STATUS_ORDER[number])
    if (idx < 0 || idx >= STATUS_ORDER.length - 1) return
    const next = STATUS_ORDER[idx + 1]
    const tipo = next === 'checkin' ? 'checkin' : 'checkout'
    const label = next === 'checkin' ? 'Check-in realizado' : 'Check-out realizado'
    const updated: Booking = {
      ...booking,
      estado: next,
      historico: [...booking.historico, { id: uuid(), data: new Date().toISOString(), tipo, descricao: label }],
    }
    store.saveBooking(updated)
    setBooking(updated)
  }

  function confirm() {
    if (!booking || booking.estado !== 'pendente') return
    const updated: Booking = {
      ...booking,
      estado: 'confirmada',
      historico: [...booking.historico, { id: uuid(), data: new Date().toISOString(), tipo: 'confirmada', descricao: 'Confirmada manualmente' }],
    }
    store.saveBooking(updated)
    setBooking(updated)
  }

  function addNote() {
    if (!booking || !note.trim()) return
    const updated: Booking = {
      ...booking,
      notas: note.trim(),
      historico: [...booking.historico, { id: uuid(), data: new Date().toISOString(), tipo: 'nota', descricao: `Nota: ${note.trim()}` }],
    }
    store.saveBooking(updated)
    setBooking(updated)
    setNote('')
    setShowNote(false)
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return }
    if (!booking) return
    store.deleteBooking(booking.id)
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
  const isActive = booking.estado === 'checkin'
  const isPending = booking.estado === 'pendente'
  const isConfirmed = booking.estado === 'confirmada'
  const canAdvance = isActive || isConfirmed
  const nextLabel = isActive ? 'Registar check-out' : isPending ? 'Confirmar reserva' : isConfirmed ? 'Registar check-in' : null

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
        {nextLabel && (
          <div className="px-4">
            <button
              onClick={isPending ? confirm : advance}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm active:opacity-80 transition-opacity"
            >
              {nextLabel}
            </button>
          </div>
        )}

        {/* Alert: saldo */}
        {saldo > 0 && booking.estado !== 'cancelada' && (
          <div className="flex items-start gap-3 mx-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Pagamento pendente</p>
              <p className="text-xs text-amber-700">{fmtMoney(saldo)} por receber</p>
            </div>
          </div>
        )}

        {/* Guest */}
        <Section title="Hóspede">
          <Link href={`/hospedes/${guest?.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 transition-colors border-b border-border last:border-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-primary">{guest?.nome?.[0] ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{guest?.nome}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {guest?.nacionalidade && <span className="text-xs text-muted-foreground">{guest.nacionalidade}</span>}
                {guest?.tags.map(tag => (
                  <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TAG_CLASS[tag]}`}>
                    {TAG_LABEL[tag]}
                  </span>
                ))}
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>
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
          <Row label="Recebido" value={<span className={booking.preco_pago >= booking.preco_total ? 'text-emerald-600 font-semibold' : ''}>{fmtMoney(booking.preco_pago)}</span>} />
          {saldo > 0 && <Row label="Por receber" value={<span className="text-destructive font-semibold">{fmtMoney(saldo)}</span>} />}
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
          <button onClick={() => setShowNote(true)} className="flex items-center gap-2 text-sm text-muted-foreground mx-4 py-1">
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
