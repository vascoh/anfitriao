'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CalendarCheck2, Users, Building2, X } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/store'
import { STATUS_LABEL, STATUS_CLASS } from '@/lib/labels'
import type { Booking, Guest, Property } from '@/lib/types'

interface Result {
  type: 'booking' | 'guest' | 'property'
  id: string
  title: string
  subtitle: string
  href: string
  color?: string
  badge?: string
  badgeClass?: string
}

function search(q: string, bookings: Booking[], guests: Guest[], props: Property[]): Result[] {
  if (!q.trim()) return []
  const lq = q.toLowerCase()
  const results: Result[] = []

  guests.filter(g => g.nome.toLowerCase().includes(lq) || g.email?.toLowerCase().includes(lq)).slice(0, 4).forEach(g => {
    results.push({ type: 'guest', id: g.id, title: g.nome, subtitle: g.email ?? g.nacionalidade ?? '', href: `/hospedes/${g.id}` })
  })

  bookings.filter(b => {
    const g = guests.find(x => x.id === b.hospede_id)
    const p = props.find(x => x.id === b.propriedade_id)
    return g?.nome.toLowerCase().includes(lq) || p?.nome.toLowerCase().includes(lq) || b.id.includes(lq)
  }).slice(0, 5).forEach(b => {
    const g = guests.find(x => x.id === b.hospede_id)
    const p = props.find(x => x.id === b.propriedade_id)
    results.push({
      type: 'booking', id: b.id,
      title: g?.nome ?? '—',
      subtitle: `${p?.nome ?? '—'} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}`,
      href: `/reservas/${b.id}`,
      color: p?.cor,
      badge: STATUS_LABEL[b.estado],
      badgeClass: STATUS_CLASS[b.estado],
    })
  })

  props.filter(p => p.nome.toLowerCase().includes(lq) || p.cidade.toLowerCase().includes(lq)).slice(0, 3).forEach(p => {
    results.push({ type: 'property', id: p.id, title: p.nome, subtitle: p.cidade, href: `/propriedades/${p.id}`, color: p.cor })
  })

  return results
}

const TYPE_ICON = { booking: CalendarCheck2, guest: Users, property: Building2 }

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Load data once on mount
  useEffect(() => {
    db.getBookings().then(setBookings)
    db.getGuests().then(setGuests)
    db.getProperties().then(setProps)
  }, [])

  const results = search(q, bookings, guests, props)

  const close = useCallback(() => { setOpen(false); setQ('') }, [])

  const go = useCallback((href: string) => { close(); router.push(href) }, [close, router])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(v => !v) }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setCursor(0) }
  }, [open])

  useEffect(() => { setCursor(0) }, [q])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor].href)
    if (e.key === 'Escape') close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center pt-[10vh] px-4" onClick={close}>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pesquisar hóspedes, reservas, propriedades..."
            className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground font-mono">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1.5">
            {results.map((r, i) => {
              const Icon = TYPE_ICON[r.type]
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r.href)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${i === cursor ? 'bg-muted' : 'hover:bg-muted/50'}`}
                >
                  {r.type === 'booking' && r.color ? (
                    <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: r.color + '22' }}>
                      <Icon className="h-4 w-4" style={{ color: r.color }} />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  {r.badge && (
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.badgeClass}`}>
                      {r.badge}
                    </span>
                  )}
                  {r.type === 'property' && r.color && (
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {q && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem resultados para &ldquo;{q}&rdquo;</div>
        )}

        {!q && (
          <div className="px-4 py-4 text-center text-xs text-muted-foreground/60">
            Escreve para pesquisar em hóspedes, reservas e propriedades
          </div>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">↵</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
