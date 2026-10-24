'use client'

import Link from 'next/link'
import { Users, MapPin, ExternalLink } from 'lucide-react'
import { fmtDate } from '@/lib/utils'
import type { Booking, Property } from '@/lib/types'
import { SOURCE_LABEL, SOURCE_BG } from '@/lib/labels'
import { Section, Row } from './blocos'

export function DetalhesReserva({ booking, noites: n }: { booking: Booking; noites: number }) {
  return (
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
  )
}

export function CartaoPropriedade({ prop }: { prop: Property | null }) {
  return (
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
  )
}
