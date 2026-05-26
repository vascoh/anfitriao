'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Mail, Phone, ArrowLeft } from 'lucide-react'
import { fmtDate, fmtMoney, nights as calcNights } from '@/lib/utils'
import { db } from '@/lib/db'
import { useParams, useSearchParams } from 'next/navigation'
import type { Booking, Property, WebsiteSettings } from '@/lib/types'

export default function ConfirmacaoPage() {
  return (
    <Suspense>
      <ConfirmacaoInner />
    </Suspense>
  )
}

function ConfirmacaoInner() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const searchParamsObj = useSearchParams()
  const bookingId = searchParamsObj.get('b') ?? undefined
  const nome = searchParamsObj.get('nome') ?? undefined
  const [booking, setBooking] = useState<Booking | null>(null)
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [prop, setProp] = useState<Property | null>(null)

  useEffect(() => {
    db.getWebsiteSettings().then(setSettings)
    if (bookingId) {
      db.getBookings().then(bookings => {
        const b = bookings.find(x => x.id === bookingId) ?? null
        setBooking(b)
        if (b) {
          db.getProperties().then(props => {
            setProp(props.find(p => p.id === b.propriedade_id) ?? null)
          })
        }
      })
    }
  }, [bookingId])

  const numNights = booking ? calcNights(booking.check_in, booking.check_out) : 0

  const waLink = settings?.telefone
    ? `https://wa.me/${settings.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá! Acabei de submeter um pedido de reserva em ${prop?.nome ?? 'alojamento'}` +
        (booking ? ` para ${fmtDate(booking.check_in)} – ${fmtDate(booking.check_out)}.` : '.') +
        ` O meu nome é ${nome ?? 'hóspede'}.`
      )}`
    : null

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Link href="/book" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold text-muted-foreground">Reserva submetida</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          {/* Success animation */}
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">
              {nome ? `Obrigado, ${nome.split(' ')[0]}!` : 'Pedido enviado!'}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              O seu pedido de reserva foi recebido com sucesso.
              Entraremos em contacto brevemente para confirmar os detalhes e combinar o pagamento.
            </p>
          </div>

          {/* Property + booking summary */}
          {booking && prop && (
            <div className="w-full rounded-2xl border border-border bg-card overflow-hidden">
              {prop.imagem_url && (
                <div className="relative h-32 overflow-hidden">
                  <Image src={prop.imagem_url} alt={prop.nome} fill sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                </div>
              )}
              {!prop.imagem_url && (
                <div className="h-1.5 w-full" style={{ backgroundColor: prop.cor }} />
              )}
              <div className="p-4 flex flex-col gap-3 text-left">
                <p className="font-bold">{prop.nome}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Check-in</span>
                    <span className="font-semibold">{fmtDate(booking.check_in, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Check-out</span>
                    <span className="font-semibold">{fmtDate(booking.check_out, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Noites</span>
                    <span className="font-semibold">{numNights}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Hóspedes</span>
                    <span className="font-semibold">{booking.num_hospedes}</span>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total estimado</span>
                  <span className="text-lg font-bold text-primary">{fmtMoney(booking.preco_total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Sem taxas de serviço · Pagamento acordado com o anfitrião</p>
              </div>
            </div>
          )}

          {/* Contact actions */}
          <div className="w-full flex flex-col gap-3">
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-sm bg-[#25D366] text-white hover:opacity-90 transition-opacity">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Confirmar via WhatsApp
              </a>
            )}

            {settings?.email && (
              <a href={`mailto:${settings.email}?subject=Reserva ${prop?.nome ?? ''}&body=Olá! Acabei de submeter um pedido de reserva. O meu nome é ${nome ?? ''}.`}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm border border-border hover:bg-muted transition-colors">
                <Mail className="h-4 w-4" />
                Enviar email
              </a>
            )}

            {settings?.telefone && !waLink && (
              <a href={`tel:${settings.telefone}`}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm border border-border hover:bg-muted transition-colors">
                <Phone className="h-4 w-4" />
                Ligar
              </a>
            )}
          </div>

          <Link href="/book"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Ver outros alojamentos
          </Link>
        </div>
      </div>
    </div>
  )
}
