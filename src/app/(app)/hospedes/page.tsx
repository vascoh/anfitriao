'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, ArrowRight, Download, ShieldCheck, ShieldAlert } from 'lucide-react'
import { db } from '@/lib/db'
import type { Guest, Booking, Property } from '@/lib/types'
import { TAG_LABEL, TAG_CLASS } from '@/lib/labels'

function sibaStatus(g: Guest) {
  const ok = !!(g.numero_documento && g.data_nascimento && g.tipo_documento && (g.sexo || g.pais_emissao))
  return ok
}

function avatarLetter(nome: string) { return nome?.[0]?.toUpperCase() ?? '?' }

function buildSibaCsv(guests: Guest[], bookings: Booking[], props: Property[]) {
  const cols = [
    'Nome', 'Data Nascimento', 'Sexo', 'Nacionalidade',
    'Tipo Documento', 'Nº Documento', 'Validade Documento', 'País Emissão',
    'Check-in', 'Check-out', 'Nº Noites', 'Propriedade',
  ]
  const rows: string[][] = []
  const activeBookings = bookings.filter(b => b.estado !== 'cancelada' && b.estado !== 'no_show')
  for (const b of activeBookings) {
    const g = guests.find(x => x.id === b.hospede_id)
    if (!g) continue
    const p = props.find(x => x.id === b.propriedade_id)
    const noites = Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
    rows.push([
      g.nome ?? '',
      g.data_nascimento ?? '',
      g.sexo ?? '',
      g.nacionalidade ?? '',
      g.tipo_documento ?? '',
      g.numero_documento ?? '',
      g.data_validade_doc ?? '',
      g.pais_emissao ?? '',
      b.check_in,
      b.check_out,
      String(noites),
      p?.nome ?? '',
    ])
  }
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [cols.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
}

export default function HospedesPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    db.getGuests().then(setGuests)
    db.getBookings().then(setBookings)
    db.getProperties().then(setProps)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return guests
    const q = search.toLowerCase()
    return guests.filter(g =>
      g.nome.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.nacionalidade?.toLowerCase().includes(q)
    )
  }, [guests, search])

  function stayCount(guestId: string) {
    return bookings.filter(b => b.hospede_id === guestId && (b.estado === 'checkout' || b.estado === 'checkin')).length
  }

  function exportSiba() {
    const csv = buildSibaCsv(guests, bookings, props)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `siba-hospedes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
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
                title="Exportar dados SIBA/SEF"
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
      </header>

      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-4">
            <p className="text-base font-medium text-foreground/60">Sem hóspedes</p>
            <p className="text-sm text-muted-foreground">Os hóspedes aparecem aqui quando crias reservas.</p>
          </div>
        ) : (
          <div className="bg-card border-b border-border">
            {filtered.map(g => {
              const stays = stayCount(g.id)
              const siba = sibaStatus(g)
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
