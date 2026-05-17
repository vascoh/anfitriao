'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Mail, Phone } from 'lucide-react'
import { store, fmtDate, fmtMoney, nights as calcNights } from '@/lib/store'
import type { Booking, WebsiteSettings } from '@/lib/types'

export default function ConfirmacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ b?: string; nome?: string }>
}) {
  const { propertyId } = use(params)
  const { b: bookingId, nome } = use(searchParams)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)

  useEffect(() => {
    if (bookingId) {
      const b = store.getBookings().find(x => x.id === bookingId) ?? null
      setBooking(b)
    }
    setSettings(store.getWebsiteSettings())
  }, [bookingId])

  const prop = booking ? store.getProperties().find(p => p.id === booking.propriedade_id) : null
  const numNights = booking ? calcNights(booking.check_in, booking.check_out) : 0

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        {/* Success icon */}
        <div className="h-20 w-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Pedido enviado!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {nome ? `Obrigado, ${nome}. ` : ''}O seu pedido de reserva foi recebido.
            Entraremos em contacto em breve para confirmar os detalhes.
          </p>
        </div>

        {/* Booking summary */}
        {booking && prop && (
          <div className="w-full rounded-xl border border-border bg-card p-4 flex flex-col gap-3 text-left">
            <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: prop.cor }} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Resumo da reserva</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Alojamento</span>
                <span className="font-medium text-right max-w-[60%] truncate">{prop.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check-in</span>
                <span className="font-medium">{fmtDate(booking.check_in, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check-out</span>
                <span className="font-medium">{fmtDate(booking.check_out, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Noites</span>
                <span className="font-medium">{numNights}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hóspedes</span>
                <span className="font-medium">{booking.num_hospedes}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Total estimado</span>
                <span className="text-primary">{fmtMoney(booking.preco_total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Contact info */}
        {settings && (settings.email || settings.telefone) && (
          <div className="w-full rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-left">Contactos</p>
            {settings.email && (
              <a href={`mailto:${settings.email}?subject=Reserva ${prop?.nome ?? ''}&body=Olá, gostaria de confirmar o meu pedido de reserva.`}
                className="flex items-center gap-3 text-sm text-primary hover:underline">
                <Mail className="h-4 w-4 shrink-0" />
                {settings.email}
              </a>
            )}
            {settings.telefone && (
              <a href={`tel:${settings.telefone}`}
                className="flex items-center gap-3 text-sm text-primary hover:underline">
                <Phone className="h-4 w-4 shrink-0" />
                {settings.telefone}
              </a>
            )}
          </div>
        )}

        <Link href="/book"
          className="w-full rounded-xl border border-border py-3.5 text-sm font-semibold text-center hover:bg-muted transition-colors">
          Ver outros alojamentos
        </Link>
      </div>
    </div>
  )
}
