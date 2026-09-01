'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Plus, Download, ShieldCheck, ShieldAlert } from 'lucide-react'
import { fetchGuests, fetchBookings } from '@/lib/fetcher'
import type { Guest, Booking, GuestTag } from '@/lib/types'
import { TAG_LABEL, TAG_CLASS, sibaComplete } from '@/lib/labels'
import { today } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'

function avatarLetter(nome: string) { return nome?.[0]?.toUpperCase() ?? '?' }

export default function HospedesPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [guests, setGuests] = useState<Guest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    // Já não se carregam as propriedades: eram só para o CSV que esta página
    // construía à mão, e que passou a ser feito no servidor.
    Promise.all([fetchGuests(), fetchBookings()])
      .then(([g, b]) => { setGuests(g); setBookings(b) })
      .catch(() => setErro(true))
      .finally(() => setLoaded(true))
  }, [ownerId])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    guests.forEach(g => g.tags.forEach(t => tags.add(t)))
    return [...tags]
  }, [guests])

  const filtered = useMemo(() => {
    let result = guests
    if (tagFilter) result = result.filter(g => g.tags.includes(tagFilter as GuestTag))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(g =>
        g.nome.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.nacionalidade?.toLowerCase().includes(q)
      )
    }
    return result.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  }, [guests, search, tagFilter])

  function stayCount(guestId: string) {
    return bookings.filter(b => b.hospede_id === guestId && (b.estado === 'checkout' || b.estado === 'checkin')).length
  }

  /**
   * Exportação do boletim, pela rota do servidor.
   *
   * Havia aqui uma segunda implementação do mesmo CSV, e divergia da do
   * servidor em duas coisas que importam: exportava **uma pessoa por
   * reserva** (o boletim é por pessoa desde 03/08 — uma reserva de oito
   * comunicava uma), e **não deixava rasto** no registo de acessos, quando o
   * ficheiro leva números de documento para fora da aplicação.
   *
   * Uma implementação só, do lado do servidor, que decifra, junta os
   * acompanhantes e regista a saída (ANF-1.8).
   */
  async function exportSiba() {
    const ano = new Date().getFullYear()
    const res = await fetch(`/api/siba-export?from=${ano}-01-01&to=${ano}-12-31`)
    if (!res.ok) {
      toast.error('Não foi possível exportar. Tenta mais tarde.')
      return
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `siba-hospedes-${today()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Hóspedes</h1>
          <div className="flex items-center gap-2">
            {guests.length > 0 && (
              <button
                onClick={exportSiba}
                title="Exportar dados do boletim (SIBA)"
                className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                <Download className="h-3.5 w-3.5" /> SIBA
              </button>
            )}
            <Link href="/hospedes/novo"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium active:opacity-80 transition-opacity">
              <Plus className="h-3.5 w-3.5" /> Novo
            </Link>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar nome, email, nacionalidade..."
              className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none" />
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTagFilter(null)}
              className={`relative shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors after:absolute after:-inset-y-2.5 after:inset-x-0 ${
                tagFilter === null ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`relative shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border after:absolute after:-inset-y-2.5 after:inset-x-0 ${
                  tagFilter === tag
                    ? TAG_CLASS[tag as keyof typeof TAG_CLASS] ?? 'bg-foreground/10 text-foreground border-foreground/20'
                    : 'text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {TAG_LABEL[tag as keyof typeof TAG_LABEL] ?? tag}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1">
        {erro ? (
          <ErroAoCarregar oQue="os hóspedes" />
        ) : !loaded ? (
          <div className="flex flex-col animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
                <div className="h-4 w-4 rounded bg-muted shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 text-center py-20 px-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <p className="text-lg font-semibold">Sem hóspedes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Os hóspedes aparecem aqui automaticamente quando crias reservas, ou podes adicioná-los manualmente.
              </p>
            </div>
            <Link href="/hospedes/novo"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
              <Plus className="h-4 w-4" /> Adicionar hóspede
            </Link>
          </div>
        ) : (
          <div className="bg-card border-b border-border">
            {filtered.map(g => {
              const stays = stayCount(g.id)
              const siba = sibaComplete(g)
              return (
                <Link key={g.id} href={`/hospedes/${g.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{avatarLetter(g.nome)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{g.nome}</p>
                      {g.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TAG_CLASS[tag]}`}>
                          {TAG_LABEL[tag]}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {g.nacionalidade && <span className="text-xs text-muted-foreground">{g.nacionalidade}</span>}
                      {stays > 0 && (
                        <span className="text-xs text-muted-foreground">· {stays} estadi{stays !== 1 ? 'as' : 'a'}</span>
                      )}
                    </div>
                    {g.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{g.email}</p>}
                  </div>
                  {siba
                    ? <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    : <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                  }
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
