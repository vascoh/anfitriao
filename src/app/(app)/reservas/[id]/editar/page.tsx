'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { store, uuid } from '@/lib/store'
import type { Booking, BookingSource, BookingStatus } from '@/lib/types'
import { SOURCE_LABEL, STATUS_LABEL } from '@/lib/labels'

const SOURCES: BookingSource[] = ['airbnb', 'booking', 'direto', 'expedia', 'vrbo', 'outro']
const STATUSES: BookingStatus[] = ['pendente', 'confirmada', 'checkin', 'checkout', 'cancelada']

export default function EditarReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)

  // Form fields
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [numHospedes, setNumHospedes] = useState(1)
  const [origem, setOrigem] = useState<BookingSource>('direto')
  const [estado, setEstado] = useState<BookingStatus>('confirmada')
  const [precoTotal, setPrecoTotal] = useState('')
  const [precoPago, setPrecoPago] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    const b = store.getBookings().find(x => x.id === id)
    if (!b) return
    setBooking(b)
    setCheckIn(b.check_in)
    setCheckOut(b.check_out)
    setNumHospedes(b.num_hospedes)
    setOrigem(b.origem)
    setEstado(b.estado)
    setPrecoTotal(String(b.preco_total))
    setPrecoPago(String(b.preco_pago))
    setNotas(b.notas ?? '')
  }, [id])

  function handleSave() {
    if (!booking) return
    const total = parseFloat(precoTotal) || 0
    const pago = Math.min(parseFloat(precoPago) || 0, total)
    const updated: Booking = {
      ...booking,
      check_in: checkIn,
      check_out: checkOut,
      num_hospedes: numHospedes,
      origem,
      estado,
      preco_total: total,
      preco_pago: pago,
      notas: notas.trim() || undefined,
      historico: [...booking.historico, {
        id: uuid(), data: new Date().toISOString(), tipo: 'nota', descricao: 'Reserva editada manualmente'
      }],
    }
    store.saveBooking(updated)
    router.push(`/reservas/${id}`)
  }

  if (!booking) return null

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href={`/reservas/${id}`} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Editar reserva</h1>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Estado</label>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} onClick={() => setEstado(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  estado === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                }`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs text-muted-foreground font-medium">Check-in</label>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs text-muted-foreground font-medium">Check-out</label>
            <input type="date" value={checkOut} min={checkIn} onChange={e => setCheckOut(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Nº de hóspedes</label>
          <input type="number" min={1} value={numHospedes} onChange={e => setNumHospedes(Number(e.target.value))}
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
            <input type="number" min={0} value={precoTotal} onChange={e => setPrecoTotal(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs text-muted-foreground font-medium">Recebido (€)</label>
            <input type="number" min={0} value={precoPago} onChange={e => setPrecoPago(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Notas internas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Notas sobre a reserva..."
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-24 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <button onClick={handleSave}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm active:opacity-80 transition-opacity mt-2">
          Guardar alterações
        </button>
      </div>
    </div>
  )
}
