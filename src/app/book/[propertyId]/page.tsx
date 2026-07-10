import Link from 'next/link'
import {
  adminGetProperties, adminGetWebsiteSettings, adminGetBookings,
  adminGetPriceRules, adminGetTarifas, adminGetPlatformRates, adminGetPropertyById,
} from '@/lib/db-admin'
import { blockedDates } from '@/lib/reservations'
import BookingClient from './BookingClient'
import RoomsClient from './RoomsClient'

export default async function BookPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  // Resolve the property first to scope all subsequent queries by owner_id
  const prop = await adminGetPropertyById(propertyId)
  const ownerId = prop?.owner_id as string | undefined

  const [props, ws, bookings, rules, tars, rates] = await Promise.all([
    adminGetProperties(ownerId),
    adminGetWebsiteSettings(ownerId),
    adminGetBookings(ownerId),
    adminGetPriceRules(ownerId),
    adminGetTarifas(ownerId),
    adminGetPlatformRates(ownerId),
  ])

  if (!ws.enabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Website não disponível.</p>
      </div>
    )
  }

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
