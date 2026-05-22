import Link from 'next/link'
import { db } from '@/lib/db'
import { blockedDates } from '@/lib/reservations'
import type { WebsiteSettings } from '@/lib/types'
import BookingClient from './BookingClient'

const DEFAULT_WEBSITE: WebsiteSettings = {
  enabled: true,
  nome: 'Reservas Diretas',
  descricao: 'Reserve diretamente connosco sem taxas de intermediários.',
  email: '',
  telefone: '',
  min_noites: 1,
  antecedencia_dias: 1,
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

  if (!prop) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Este alojamento não está disponível.</p>
        <Link href="/book" className="text-sm text-primary hover:underline">← Ver todos os alojamentos</Link>
      </div>
    )
  }

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
