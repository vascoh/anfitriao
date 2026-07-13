'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, BedDouble, Bath, Users, MapPin } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import type { Property, WebsiteSettings } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const AMENITY_LABEL: Record<string, string> = {
  wifi: 'Wi-Fi', ar_condicionado: 'A/C', estacionamento: 'Parque',
  piscina: 'Piscina', cozinha: 'Cozinha', maquina_lavar: 'Lavandaria',
  tv: 'TV', varanda: 'Varanda', jardim: 'Jardim',
}

interface RoomCardProps {
  room: Property
  isOccupied: boolean
}

function RoomCard({ room, isOccupied }: RoomCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {room.imagem_url ? (
          <Image
            src={room.imagem_url}
            alt={room.nome}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full flex items-center justify-center" style={{ backgroundColor: room.cor + '33' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: room.cor }}>
              <BedDouble className="h-7 w-7 text-white" />
            </div>
          </div>
        )}
        {/* Occupied badge */}
        {isOccupied && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            Ocupado
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-base">{room.nome}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {PROPERTY_TYPE_LABEL[room.tipo]}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {room.quartos > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {room.quartos} cama{room.quartos !== 1 ? 's' : ''}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {room.casasBanho} WC
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Máx. {room.capacidade}
          </span>
        </div>

        {/* Description */}
        {room.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{room.descricao}</p>
        )}

        {/* Amenities */}
        {room.comodidades.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.comodidades.slice(0, 4).map(a => (
              <span key={a} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-foreground/70 font-medium">
                {AMENITY_LABEL[a] ?? a.replace(/_/g, ' ')}
              </span>
            ))}
            {room.comodidades.length > 4 && (
              <span className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-foreground/70 font-medium">
                +{room.comodidades.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="text-xl font-bold text-primary">{fmtMoney(room.preco_base)}</span>
            <span className="text-xs text-muted-foreground ml-1">/ noite</span>
          </div>
          {isOccupied ? (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-4 py-2.5 rounded-xl">
              Indisponível
            </span>
          ) : (
            <Link
              href={`/book/${room.id}`}
              className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all"
            >
              Reservar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  parent: Property
  rooms: Property[]
  settings: WebsiteSettings
  /** Set of property IDs that are currently occupied (have an active booking today) */
  occupiedIds: Set<string>
}

export default function RoomsClient({ parent, rooms, settings, occupiedIds }: Props) {
  const availableCount = rooms.filter(r => !occupiedIds.has(r.id)).length

  return (
    <div className="min-h-dvh bg-background flex flex-col">

      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/book" aria-label="Voltar" className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="font-semibold text-sm truncate flex-1">{parent.nome}</span>
      </header>

      {/* Property hero */}
      {parent.imagem_url ? (
        <div className="relative h-56 lg:h-72 overflow-hidden bg-muted">
          <Image src={parent.imagem_url} alt={parent.nome} fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            <h1 className="text-white font-bold text-2xl lg:text-3xl">{parent.nome}</h1>
            <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{parent.cidade}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-6 pb-2">
          <h1 className="font-bold text-2xl">{parent.nome}</h1>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>{parent.cidade}</span>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-6 pb-20">

        {parent.descricao && (
          <p className="text-sm text-muted-foreground leading-relaxed">{parent.descricao}</p>
        )}

        {/* Availability summary */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Quartos disponíveis</p>
            <p className="text-sm text-foreground mt-0.5">
              {availableCount === 0
                ? 'Nenhum quarto disponível hoje'
                : `${availableCount} de ${rooms.length} quarto${rooms.length !== 1 ? 's' : ''} disponível${availableCount !== 1 ? 'is' : ''} hoje`}
            </p>
          </div>
          {availableCount > 0 && (
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>

        {/* Room cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rooms.map(room => (
            <RoomCard key={room.id} room={room} isOccupied={occupiedIds.has(room.id)} />
          ))}
        </div>

        {rooms.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sem quartos disponíveis de momento.
          </div>
        )}

        {/* Contact / WhatsApp */}
        {settings.telefone && (
          <a
            href={`https://wa.me/${settings.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de saber mais sobre ${parent.nome}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm border border-[#25D366]/40 text-[#0F7060] hover:bg-[#25D366]/5 transition-colors"
          >
            <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contactar via WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
