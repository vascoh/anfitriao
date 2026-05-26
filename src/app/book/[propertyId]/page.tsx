import Link from 'next/link'
import { db } from '@/lib/db'
import { blockedDates } from '@/lib/reservations'
import type { WebsiteSettings } from '@/lib/types'
import BookingClient from './BookingClient'
import RoomsClient from './RoomsClient'

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: true,
  nome: 'Reservas Diretas',
  descricao: 'Reserve diretamente connosco sem taxas de intermediários.',
  email: '',
  telefone: '',
  min_noites: 1,
  antecedencia_dias: 0,
}

export default async function BookPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  const [propsR, wsR, bookingsR, rulesR, tarsR, ratesR] = await Promise.allSettled([
    db.getProperties(),
    db.getWebsiteSettings(),
    db.getBookings(),
    db.getPriceRules(),
    db.getTarifas(),
    db.getPlatformRates(),
  ])

  const props = propsR.status === 'fulfilled' ? propsR.value : []
  const ws = wsR.status === 'fulfilled' ? wsR.value : DEFAULT_WEBSITE
  const bookings = bookingsR.status === 'fulfilled' ? bookingsR.value : []
  const rules = rulesR.status === 'fulfilled' ? rulesR.value : []
  const tars = tarsR.status === 'fulfilled' ? tarsR.value : []
  const rates = ratesR.status === 'fulfilled' ? ratesR.value : []

  if (!ws.enabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Website não disponível.</p>
      </div>
    )
  }

  const prop = props.find(p => p.id === propertyId) ?? null

  if (!prop || !prop.ativo) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Este alojamento não está disponível.</p>
        <Link href="/book" className="text-sm text-primary hover:underline">← Ver todos os alojamentos</Link>
      </div>
    )
  }

  // ── Parent property (has rooms) → show room selection ─────────────────────
  const rooms = props.filter(p => p.parent_id === propertyId && p.ativo)

  if (rooms.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const occupiedIds = new Set(
      rooms
        .filter(room =>
          bookings.some(b =>
            b.propriedade_id === room.id &&
            b.estado !== 'cancelada' &&
            b.estado !== 'no_show' &&
            b.check_in <= today &&
            b.check_out > today
          )
        )
        .map(r => r.id)
    )

    return (
      <RoomsClient
        parent={prop}
        rooms={rooms}
        settings={ws}
        occupiedIds={occupiedIds}
      />
    )
  }

  // ── Leaf property (room or standalone) → show booking calendar ────────────
  const blocked = blockedDates(bookings, propertyId)

  return (
    <BookingClient
      prop={prop}
      settings={ws}
      blocked={[...blocked]}
      priceRules={rules}
      tarifas={tars}
      platformRates={rates}
    />
  )
}
