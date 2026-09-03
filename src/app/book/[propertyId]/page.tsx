import Link from 'next/link'
import {
  adminGetProperties, adminGetWebsiteSettings, adminGetBookings,
  adminGetPriceRules, adminGetTarifas, adminGetPlatformRates, adminGetPropertyById,
} from '@/lib/db-admin'
import { blockedDates } from '@/lib/reservations'
import { today } from '@/lib/utils'
import { getAccountByClerkId } from '@/lib/accounts'
import { propriedadePublica, propriedadesPublicas, ocupacoesPublicas, definicoesPublicas } from '@/lib/property-publica'
import BookingClient from './BookingClient'
import RoomsClient from './RoomsClient'
import CasaInteiraClient from './CasaInteiraClient'

export default async function BookPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  // Resolve the property first to scope all subsequent queries by owner_id
  const prop = await adminGetPropertyById(propertyId)
  const ownerId = prop?.owner_id as string | undefined

  const [props, ws, reservas, rules, tars, rates, account] = await Promise.all([
    adminGetProperties(ownerId),
    adminGetWebsiteSettings(ownerId),
    adminGetBookings(ownerId),
    adminGetPriceRules(ownerId),
    adminGetTarifas(ownerId),
    adminGetPlatformRates(ownerId),
    ownerId ? getAccountByClerkId(ownerId) : Promise.resolve(null),
  ])
  const paymentsEnabled = !!account?.stripe_connect_charges_enabled

  /* Sem a lista completa de reservas não se mostra um calendário.
   *
   * As datas ocupadas saem daqui: uma leitura falhada ou cortada mostraria
   * como disponível o que já está vendido, e o hóspede só descobria depois de
   * preencher o formulário — ou, pior, não descobria. Ver `adminGetBookings`. */
  if (reservas.erro) {
    console.error('[book] leitura de reservas falhou', propertyId, reservas.erro)
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">
          Não foi possível confirmar a disponibilidade neste momento. Tenta daqui a pouco.
        </p>
      </div>
    )
  }
  const bookings = reservas.linhas

  if (!ws.enabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Website não disponível.</p>
      </div>
    )
  }

  if (!prop || !prop.ativo) {
    const backHref = ws.slug ? `/r/${ws.slug}` : '/'
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Este alojamento não está disponível.</p>
        <Link href={backHref} className="text-sm text-primary hover:underline">← Ver todos os alojamentos</Link>
      </div>
    )
  }

  // ── Parent property (has rooms) → show room selection ─────────────────────
  const rooms = props.filter(p => p.parent_id === propertyId && p.ativo)

  if (rooms.length > 0) {
    const t = today()
    const occupiedIds = new Set(
      rooms
        .filter(room =>
          bookings.some(b =>
            b.propriedade_id === room.id &&
            b.estado !== 'cancelada' &&
            b.estado !== 'no_show' &&
            b.check_in <= t &&
            b.check_out > t
          )
        )
        .map(r => r.id)
    )

    return (
      <RoomsClient
        parent={propriedadePublica(prop)}
        rooms={propriedadesPublicas(rooms)}
        settings={definicoesPublicas(ws)}
        occupiedIds={occupiedIds}
        casaInteira={
          <CasaInteiraClient
            casa={propriedadePublica(prop)}
            quartos={propriedadesPublicas(rooms)}
            ocupacoes={ocupacoesPublicas(bookings)}
            priceRules={rules}
            tarifas={tars}
            platformRates={rates}
            minNoites={ws.min_noites ?? 1}
          />
        }
      />
    )
  }

  // ── Leaf property (room or standalone) → show booking calendar ────────────
  const blocked = blockedDates(bookings, propertyId)

  return (
    <BookingClient
      prop={propriedadePublica(prop)}
      settings={definicoesPublicas(ws)}
      blocked={[...blocked]}
      priceRules={rules}
      tarifas={tars}
      platformRates={rates}
      paymentsEnabled={paymentsEnabled}
    />
  )
}
