'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, BedDouble, ChevronDown, ChevronRight as ChevronRightIcon, Home } from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney, today as localToday } from '@/lib/utils'
import { guardar } from '@/lib/guardar'
import { fetchProperties, fetchBookings, fetchGuests } from '@/lib/fetcher'
import { occupancyForMonth } from '@/lib/reservations'
import type { Property, Booking, Guest } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'
import { useUser } from '@clerk/nextjs'

/**
 * Assistente para agrupar alojamentos soltos numa casa.
 *
 * O modelo casa→quartos existia, mas era invisível: quem criasse a casa e os
 * quartos pela ordem natural ficava com quatro alojamentos ao mesmo nível e
 * sem nada no ecrã a sugerir que podiam estar relacionados. Reparar nisso
 * exigia saber de antemão que a funcionalidade existia — que é a definição de
 * implícito.
 *
 * Aparece só quando há material para agrupar (duas ou mais unidades soltas) e
 * desaparece assim que se agrupa. Não decide nada sozinho: um T1 e um T2 na
 * mesma cidade são dois alojamentos independentes, e adivinhar aqui seria pior
 * do que perguntar.
 */
function AssistenteAgrupar({ soltos, aoAgrupar }: {
  soltos: Property[]
  aoAgrupar: () => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [casaId, setCasaId] = useState<string>('')
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())
  const [aGravar, setAGravar] = useState(false)

  const quartos = soltos.filter(p => p.id !== casaId)

  function alternar(id: string) {
    setEscolhidos(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  async function agrupar() {
    if (!casaId || escolhidos.size === 0) return
    setAGravar(true)
    try {
      for (const id of escolhidos) {
        const quarto = soltos.find(p => p.id === id)
        if (!quarto) continue
        if (!await guardar('/api/properties', { ...quarto, parent_id: casaId })) {
          setAGravar(false)
          return
        }
      }
      const casa = soltos.find(p => p.id === casaId)
      toast.success(
        `${escolhidos.size} ${escolhidos.size === 1 ? 'quarto agrupado' : 'quartos agrupados'} em ${casa?.nome}.`,
      )
      setAberto(false)
      setEscolhidos(new Set())
      setCasaId('')
      await aoAgrupar()
    } finally {
      setAGravar(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3.5 text-left hover:border-primary/50 transition-colors"
      >
        <Home className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">
            Algum destes alojamentos é um quarto de outro?
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Tens {soltos.length} alojamentos independentes. Se forem quartos da mesma casa —
            alugados em separado, a hóspedes diferentes — podes agrupá-los aqui. A ocupação
            passa a somar-se num só calendário.
          </span>
        </span>
        <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold flex-1">Agrupar em casa e quartos</span>
        <button onClick={() => setAberto(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="agrupar-casa" className="text-xs font-semibold">
          1. Qual deles é a casa?
        </label>
        <select
          id="agrupar-casa"
          value={casaId}
          onChange={e => { setCasaId(e.target.value); setEscolhidos(new Set()) }}
          className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Escolhe a casa…</option>
          {soltos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      {casaId && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold">2. Quais destes são quartos dela?</p>
          {quartos.map(p => (
            <label key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={escolhidos.has(p.id)}
                onChange={() => alternar(p.id)}
                className="h-4 w-4 shrink-0 accent-[color:var(--primary)]"
              />
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.cor }} aria-hidden />
              <span className="text-sm flex-1 min-w-0 truncate">{p.nome}</span>
            </label>
          ))}
        </div>
      )}

      {escolhidos.size > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
          <strong>{soltos.find(p => p.id === casaId)?.nome}</strong> deixa de se alugar por inteiro
          e passa a alugar-se quarto a quarto. O calendário dela passa a mostrar a ocupação de
          todos os quartos juntos — é esse o calendário que exportas para o Airbnb e o Booking.
          As reservas que já existem não se perdem.
        </p>
      )}

      <button
        onClick={agrupar}
        disabled={!casaId || escolhidos.size === 0 || aGravar}
        className="self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 active:opacity-80 transition-opacity"
      >
        {aGravar ? 'A agrupar…' : `Agrupar ${escolhidos.size || ''} ${escolhidos.size === 1 ? 'quarto' : 'quartos'}`.trim()}
      </button>
    </div>
  )
}

function PropertyCard({ p, bookings, guests, isRoom = false }: {
  p: Property
  bookings: Booking[]
  guests: Guest[]
  isRoom?: boolean
}) {
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()
  const today = localToday()

  const active = bookings.find(b => b.propriedade_id === p.id && b.estado === 'checkin')
  const next = bookings
    .filter(b => b.propriedade_id === p.id && b.estado === 'confirmada' && b.check_in >= today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
  const activeGuest = active ? guests.find(g => g.id === active.hospede_id) : null
  const nextGuest = next ? guests.find(g => g.id === next.hospede_id) : null
  const pb = bookings.filter(b => b.propriedade_id === p.id && ['confirmada', 'checkin', 'checkout'].includes(b.estado))
  const stats = { count: pb.length, revenue: pb.reduce((s, b) => s + (b.preco_total ?? 0), 0) }
  const occ = occupancyForMonth(bookings, p.id, thisYear, thisMonth)

  return (
    <Link href={`/propriedades/${p.id}`}
      className={`rounded-xl border border-border bg-card overflow-hidden active:bg-muted/40 transition-colors ${isRoom ? 'ml-6 border-l-2' : ''}`}
      style={isRoom ? { borderLeftColor: p.cor } : undefined}
    >
      {!isRoom && <div className="h-1.5 w-full" style={{ backgroundColor: p.cor }} />}

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isRoom && <BedDouble className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <p className="font-semibold text-base leading-tight">{p.nome}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{PROPERTY_TYPE_LABEL[p.tipo]} · {p.cidade}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {occ.pct > 0 && (
              <span className={`text-xs font-bold tabular-nums ${occ.pct >= 80 ? 'text-emerald-600' : occ.pct >= 50 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {occ.pct}%
              </span>
            )}
            <div className={`h-3 w-3 rounded-full ${p.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.quartos} quarto{p.quartos !== 1 ? 's' : ''}</span>
          <span>max {p.capacidade} pax</span>
          <span className="font-medium text-foreground">€{p.preco_base}/noite</span>
        </div>

        {stats.count > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{stats.count} reserva{stats.count !== 1 ? 's' : ''}</span>
              <span className="text-foreground font-medium">{fmtMoney(stats.revenue)} total</span>
            </div>
            {occ.pct > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${occ.pct >= 80 ? 'bg-emerald-500' : occ.pct >= 50 ? 'bg-amber-400' : 'bg-primary/50'}`}
                    style={{ width: `${occ.pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{occ.occupied}/{occ.total}d</span>
              </div>
            )}
          </div>
        )}

        {active ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Em casa: {activeGuest?.nome}</span>
          </div>
        ) : next ? (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-xs font-medium text-blue-800 dark:text-blue-400">
              Próxima: {nextGuest?.nome} · {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(next.check_in + 'T00:00:00'))}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <span className="text-xs text-muted-foreground">Disponível</span>
          </div>
        )}
      </div>
    </Link>
  )
}

function ParentPropertyGroup({ parent, rooms, bookings, guests }: {
  parent: Property
  rooms: Property[]
  bookings: Booking[]
  guests: Guest[]
}) {
  const [expanded, setExpanded] = useState(true)

  // Aggregate occupancy across all rooms
  const today = localToday()
  const occupiedRooms = rooms.filter(r =>
    bookings.some(b => b.propriedade_id === r.id && b.estado === 'checkin')
  ).length
  const freeRooms = rooms.filter(r =>
    !bookings.some(b =>
      b.propriedade_id === r.id &&
      b.estado !== 'cancelada' &&
      b.estado !== 'no_show' &&
      b.check_in <= today &&
      b.check_out > today
    )
  ).length

  return (
    <div className="flex flex-col gap-2">
      {/* Parent header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: parent.cor }} />
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Home className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base leading-tight">{parent.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{parent.cidade} · {rooms.length} quarto{rooms.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs font-medium text-emerald-600">{freeRooms} livre{freeRooms !== 1 ? 's' : ''}</p>
                {occupiedRooms > 0 && <p className="text-xs text-muted-foreground">{occupiedRooms} ocupado{occupiedRooms !== 1 ? 's' : ''}</p>}
              </div>
              <div className="flex gap-1">
                <Link href={`/propriedades/${parent.id}`}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium"
                  onClick={e => e.stopPropagation()}>
                  Gerir
                </Link>
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {expanded
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRightIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Room availability strip */}
          <div className="flex gap-1.5">
            {rooms.map(r => {
              const occupied = bookings.some(b =>
                b.propriedade_id === r.id &&
                b.estado !== 'cancelada' &&
                b.estado !== 'no_show' &&
                b.check_in <= today &&
                b.check_out > today
              )
              return (
                <div key={r.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-2 rounded-full ${occupied ? 'bg-primary' : 'bg-emerald-400'}`} />
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                    {r.nome.split(' ').pop()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Room cards */}
      {expanded && (
        <div className="flex flex-col gap-2">
          {rooms.map(room => (
            <PropertyCard key={room.id} p={room} bookings={bookings} guests={guests} isRoom />
          ))}
          <Link href={`/propriedades/nova?parent=${parent.id}`}
            className="ml-6 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors">
            <Plus className="h-4 w-4" />
            Adicionar quarto a {parent.nome}
          </Link>
        </div>
      )}
    </div>
  )
}

export default function PropriedadesPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [allProps, setAllProps] = useState<Property[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchProperties(), fetchBookings(), fetchGuests()])
      .then(([p, b, g]) => { setAllProps(p); setBookings(b); setGuests(g) })
      .finally(() => setLoaded(true))
  }, [ownerId])

  /* Depois de agrupar, a lista tem de se redesenhar: os quartos saltam de
   * «independentes» para dentro da casa. */
  async function recarregar() {
    setAllProps(await fetchProperties())
  }

  // Separate parents from rooms
  const parents = allProps.filter(p => !p.parent_id)
  const roomsByParent = allProps.filter(p => p.parent_id)

  // Properties with rooms
  const parentsWithRooms = parents.filter(p =>
    roomsByParent.some(r => r.parent_id === p.id)
  )
  // Standalone properties (no rooms, no parent)
  const standalone = parents.filter(p =>
    !roomsByParent.some(r => r.parent_id === p.id)
  )

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Propriedades</h1>
          <Link href="/propriedades/nova"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium active:opacity-80 transition-opacity">
            <Plus className="h-3.5 w-3.5" /> Nova
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {!loaded ? (
          <div className="flex flex-col gap-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="h-1.5 w-full bg-muted" />
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="h-3 w-28 rounded bg-muted" />
                    </div>
                    <div className="h-3 w-3 rounded-full bg-muted" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                  <div className="h-9 w-full rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : allProps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 text-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BedDouble className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <p className="text-lg font-semibold">Nenhuma propriedade</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cria a tua primeira propriedade para começar a receber reservas, gerir preços e organizar hóspedes.
              </p>
            </div>
            <Link href="/propriedades/nova"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
              <Plus className="h-4 w-4" /> Criar propriedade
            </Link>
          </div>
        ) : (
          <>
            {/* Parent properties with rooms */}
            {parentsWithRooms.map(parent => (
              <ParentPropertyGroup
                key={parent.id}
                parent={parent}
                rooms={roomsByParent.filter(r => r.parent_id === parent.id)}
                bookings={bookings}
                guests={guests}
              />
            ))}

            {/* Só faz sentido perguntar quando há material para agrupar. */}
            {standalone.length >= 2 && (
              <AssistenteAgrupar soltos={standalone} aoAgrupar={recarregar} />
            )}

            {/* Standalone properties
              *
              * O «Adicionar quarto» vivia só no `ParentPropertyGroup`, ou seja
              * só aparecia em casas que **já tinham** quartos. Uma casa
              * acabada de criar caía aqui, sem esse link em lado nenhum: para
              * lhe pôr o primeiro quarto era preciso adivinhar o
              * `?parent=<id>` no URL. Quem seguia a ordem natural — criar a
              * casa, depois os quartos — acabava com tudo à solta e sem forma
              * de o arrumar. */}
            {standalone.map(p => (
              <div key={p.id} className="flex flex-col gap-2">
                <PropertyCard p={p} bookings={bookings} guests={guests} />
                <Link href={`/propriedades/nova?parent=${p.id}`}
                  className="ml-6 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Dividir em quartos — adicionar quarto a {p.nome}
                </Link>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
