'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, BedDouble, Bath, Users, MapPin, Wifi, Wind, Car, Waves, UtensilsCrossed, WashingMachine, Tv, Trees, Key, BookOpen, Trash2, ChevronDown, ChevronUp, ExternalLink, Rss, Copy, Check } from 'lucide-react'
import { fmtDate, fmtMoney, nights } from '@/lib/store'
import { db } from '@/lib/db'
import type { Property, Booking, Guest } from '@/lib/types'
import { STATUS_LABEL, STATUS_CLASS, PROPERTY_TYPE_LABEL } from '@/lib/labels'

const AMENITY_LABELS: Record<string, string> = {
  wifi: 'Wi-Fi',
  ar_condicionado: 'Ar condicionado',
  estacionamento: 'Estacionamento',
  piscina: 'Piscina',
  cozinha: 'Cozinha',
  maquina_lavar: 'Máquina lavar',
  secador: 'Secador',
  tv: 'TV',
  varanda: 'Varanda',
  jardim: 'Jardim',
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi:            <Wifi className="h-3 w-3" />,
  ar_condicionado: <Wind className="h-3 w-3" />,
  estacionamento:  <Car className="h-3 w-3" />,
  piscina:         <Waves className="h-3 w-3" />,
  cozinha:         <UtensilsCrossed className="h-3 w-3" />,
  maquina_lavar:   <WashingMachine className="h-3 w-3" />,
  secador:         <Wind className="h-3 w-3" />,
  tv:              <Tv className="h-3 w-3" />,
  varanda:         <Trees className="h-3 w-3" />,
  jardim:          <Trees className="h-3 w-3" />,
}

export default function PropriedadeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [showCheckin, setShowCheckin] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [websiteEnabled, setWebsiteEnabled] = useState(false)
  const [icalCopied, setIcalCopied] = useState(false)

  useEffect(() => {
    Promise.all([db.getProperties(), db.getWebsiteSettings(), db.getBookings(), db.getGuests()]).then(
      ([propsAll, ws, bookingsAll, guestsAll]) => {
        setProp(propsAll.find(x => x.id === id) ?? null)
        setWebsiteEnabled(ws.enabled)
        setBookings(
          bookingsAll
            .filter(b => b.propriedade_id === id)
            .sort((a, b) => b.check_in.localeCompare(a.check_in))
        )
        setGuests(guestsAll)
      }
    )
  }, [id])

  async function toggleActive() {
    if (!prop) return
    const updated = { ...prop, ativo: !prop.ativo }
    await db.saveProperty(updated)
    setProp(updated)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await db.deleteProperty(id)
    router.push('/propriedades')
  }

  if (!prop) return null

  const activeBooking = bookings.find(b => b.estado === 'checkin')
  const t = new Date().toISOString().slice(0, 10)
  const nextBooking = bookings
    .filter(b => b.estado === 'confirmada' && b.check_in >= t)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]

  const monthStart = t.slice(0, 8) + '01'
  const year = parseInt(t.slice(0, 4))
  const month = parseInt(t.slice(5, 7)) // 1-based
  const daysInMonth = new Date(year, month, 0).getDate()
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const occupiedDays = bookings
    .filter(b => b.estado !== 'cancelada' && b.estado !== 'no_show' && b.check_in < nextMonthStart && b.check_out > monthStart)
    .reduce((acc, b) => {
      const start = b.check_in > monthStart ? b.check_in : monthStart
      const end = b.check_out < nextMonthStart ? b.check_out : nextMonthStart
      return acc + Math.max(0, Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000))
    }, 0)
  const occupancyPct = Math.round((occupiedDays / daysInMonth) * 100)

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        {/* Color bar */}
        <div className="h-1 w-full" style={{ backgroundColor: prop.cor }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/propriedades" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1 truncate">{prop.nome}</h1>
          <Link href={`/propriedades/${id}/editar`} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Edit2 className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-5 py-4">
        {/* Status + quick stats */}
        <div className="px-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleActive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                prop.ativo
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${prop.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {prop.ativo ? 'Ativa' : 'Inativa'}
            </button>
            <span className="text-xs text-muted-foreground">{PROPERTY_TYPE_LABEL[prop.tipo]}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{prop.endereco}, {prop.cidade}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col items-center gap-1">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{prop.quartos}</p>
              <p className="text-[10px] text-muted-foreground">quartos</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col items-center gap-1">
              <Bath className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{prop.casasBanho}</p>
              <p className="text-[10px] text-muted-foreground">casas de banho</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold">{prop.capacidade}</p>
              <p className="text-[10px] text-muted-foreground">máx. hóspedes</p>
            </div>
          </div>
        </div>

        {/* Current status */}
        {activeBooking ? (
          <div className="mx-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-800 mb-2">Em casa agora</p>
            {(() => {
              const g = guests.find(g => g.id === activeBooking.hospede_id)
              const n = nights(activeBooking.check_in, activeBooking.check_out)
              return (
                <Link href={`/reservas/${activeBooking.id}`} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-200 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-emerald-800">{g?.nome[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">{g?.nome}</p>
                    <p className="text-xs text-emerald-700">Saída: {fmtDate(activeBooking.check_out)} · {n} noites</p>
                  </div>
                </Link>
              )
            })()}
          </div>
        ) : nextBooking ? (
          <div className="mx-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-800 mb-2">Próxima reserva</p>
            {(() => {
              const g = guests.find(g => g.id === nextBooking.hospede_id)
              return (
                <Link href={`/reservas/${nextBooking.id}`} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-blue-800">{g?.nome[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-900">{g?.nome}</p>
                    <p className="text-xs text-blue-700">Entrada: {fmtDate(nextBooking.check_in)}</p>
                  </div>
                </Link>
              )
            })()}
          </div>
        ) : (
          <div className="mx-4 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">Disponível — sem reservas próximas</p>
          </div>
        )}

        {/* Pricing + occupancy */}
        <div className="px-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Preço base</p>
              <p className="text-xl font-bold mt-0.5">{fmtMoney(prop.preco_base)}<span className="text-xs font-normal text-muted-foreground">/noite</span></p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Ocupação este mês</p>
              <p className="text-xl font-bold mt-0.5">{occupancyPct}%</p>
              <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${occupancyPct}%`, backgroundColor: prop.cor }} />
              </div>
            </div>
          </div>
        </div>

        {/* Amenities */}
        {prop.comodidades.length > 0 && (
          <div className="px-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comodidades</p>
            <div className="flex flex-wrap gap-2">
              {prop.comodidades.map(a => (
                <span key={a} className="flex items-center gap-1 text-xs bg-muted/60 text-foreground/70 px-2.5 py-1 rounded-full">
                  {AMENITY_ICONS[a] ?? <Wifi className="h-3 w-3" />}
                  {AMENITY_LABELS[a] ?? a.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Check-in instructions */}
        {prop.instrucoes_checkin && (
          <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setShowCheckin(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium">Instruções de check-in</span>
              {showCheckin ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showCheckin && (
              <div className="px-4 pb-4 border-t border-border">
                <p className="text-sm text-foreground/80 leading-relaxed pt-3 whitespace-pre-line">{prop.instrucoes_checkin}</p>
              </div>
            )}
          </div>
        )}

        {/* House rules */}
        {prop.regras_casa && (
          <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setShowRules(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium">Regras da casa</span>
              {showRules ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showRules && (
              <div className="px-4 pb-4 border-t border-border">
                <p className="text-sm text-foreground/80 leading-relaxed pt-3 whitespace-pre-line">{prop.regras_casa}</p>
              </div>
            )}
          </div>
        )}

        {/* Booking history */}
        {bookings.length > 0 && (
          <div className="flex flex-col gap-2 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Reservas recentes</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {bookings.slice(0, 5).map(b => {
                const g = guests.find(x => x.id === b.hospede_id)
                const n = nights(b.check_in, b.check_out)
                return (
                  <Link key={b.id} href={`/reservas/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{g?.nome[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g?.nome ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {n}n</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_CLASS[b.estado]}`}>
                      {STATUS_LABEL[b.estado]}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 flex flex-col gap-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/reservas/nova?propriedade=${id}`}
              className="bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm text-center active:opacity-80 transition-opacity">
              Nova reserva
            </Link>
            <a href={`/book/${id}`} target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3.5 font-semibold text-sm border transition-opacity active:opacity-80 ${
                websiteEnabled
                  ? 'border-primary text-primary hover:bg-primary/5'
                  : 'border-border text-muted-foreground cursor-not-allowed opacity-50'
              }`}
              onClick={e => { if (!websiteEnabled) e.preventDefault() }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver no website
            </a>
          </div>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/api/ical/${id}`
              await navigator.clipboard.writeText(url)
              setIcalCopied(true)
              setTimeout(() => setIcalCopied(false), 2000)
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
          >
            {icalCopied ? <Check className="h-4 w-4 text-primary" /> : <Rss className="h-4 w-4" />}
            {icalCopied ? 'URL copiado!' : 'Copiar URL do calendário (iCal)'}
          </button>
          <button
            onClick={handleDelete}
            className={`w-full rounded-xl py-3 text-sm font-medium border transition-colors ${
              confirmDelete
                ? 'bg-red-500 text-white border-red-500'
                : 'border-border text-red-500'
            }`}
          >
            {confirmDelete ? 'Confirmar eliminação' : 'Eliminar propriedade'}
          </button>
          {confirmDelete && (
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground text-center">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
