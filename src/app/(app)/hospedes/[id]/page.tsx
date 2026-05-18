'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, FileText, Edit2, ArrowRight } from 'lucide-react'
import { fmtDate, fmtMoney, nights } from '@/lib/store'
import { db } from '@/lib/db'
import type { Guest, Booking, Property } from '@/lib/types'
import { TAG_LABEL, TAG_CLASS, STATUS_LABEL, STATUS_CLASS, SOURCE_LABEL } from '@/lib/labels'

export default function HospedeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [guest, setGuest] = useState<Guest | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [editing, setEditing] = useState(false)

  // Edit state
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nacionalidade, setNacionalidade] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    Promise.all([db.getGuests(), db.getBookings(), db.getProperties()]).then(([guestsAll, bookingsAll, propsAll]) => {
      const g = guestsAll.find(x => x.id === id) ?? null
      setGuest(g)
      if (g) {
        setNome(g.nome)
        setEmail(g.email ?? '')
        setTelefone(g.telefone ?? '')
        setNacionalidade(g.nacionalidade ?? '')
        setNotas(g.notas ?? '')
      }
      setBookings(bookingsAll.filter(b => b.hospede_id === id).sort((a, b) => b.check_in.localeCompare(a.check_in)))
      setProps(propsAll)
    })
  }, [id])

  async function save() {
    if (!guest) return
    const updated: Guest = { ...guest, nome: nome.trim(), email: email.trim() || undefined, telefone: telefone.trim() || undefined, nacionalidade: nacionalidade.trim() || undefined, notas: notas.trim() || undefined }
    await db.saveGuest(updated)
    setGuest(updated)
    setEditing(false)
  }

  const totalGasto = bookings.filter(b => b.estado !== 'cancelada').reduce((acc, b) => acc + b.preco_total, 0)
  const numEstadias = bookings.filter(b => b.estado === 'checkout' || b.estado === 'checkin').length

  if (!guest) return null

  return (
    <div className="flex flex-col min-h-full pb-6">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/hospedes" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold flex-1 truncate">{guest.nome}</h1>
          <button onClick={() => setEditing(v => !v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-5 py-4">
        {/* Avatar + Tags */}
        <div className="flex flex-col items-center gap-3 px-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">{guest.nome[0]}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {guest.tags.map(tag => (
              <span key={tag} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${TAG_CLASS[tag]}`}>
                {TAG_LABEL[tag]}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 px-4">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Estadias</p>
            <p className="text-2xl font-bold mt-0.5">{numEstadias}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-2xl font-bold mt-0.5">{fmtMoney(totalGasto)}</p>
          </div>
        </div>

        {/* Edit form or info */}
        {editing ? (
          <div className="mx-4 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold">Editar hóspede</p>
            {[
              { label: 'Nome', value: nome, set: setNome, type: 'text', placeholder: 'Nome completo' },
              { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'email@exemplo.com' },
              { label: 'Telefone', value: telefone, set: setTelefone, type: 'tel', placeholder: '+351 912 345 678' },
              { label: 'Nacionalidade', value: nacionalidade, set: setNacionalidade, type: 'text', placeholder: 'Ex: Alemã' },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Preferências, observações..."
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-none min-h-20 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium">Guardar</button>
              <button onClick={() => setEditing(false)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden">
            {guest.email && (
              <a href={`mailto:${guest.email}`} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{guest.email}</span>
              </a>
            )}
            {guest.telefone && (
              <a href={`tel:${guest.telefone}`} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{guest.telefone}</span>
              </a>
            )}
            {guest.nacionalidade && (
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{guest.nacionalidade}</span>
              </div>
            )}
            {(!guest.email && !guest.telefone && !guest.nacionalidade) && (
              <div className="px-4 py-3.5">
                <button onClick={() => setEditing(true)} className="text-sm text-primary">Adicionar contactos</button>
              </div>
            )}
          </div>
        )}

        {/* SIBA Document data */}
        {(guest.numero_documento || guest.data_nascimento || guest.tipo_documento) && !editing && (
          <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Dados SIBA</p>
            </div>
            {[
              { label: 'Tipo documento', value: guest.tipo_documento },
              { label: 'Nº documento', value: guest.numero_documento },
              { label: 'Validade', value: guest.data_validade_doc },
              { label: 'Data de nascimento', value: guest.data_nascimento },
              { label: 'Sexo', value: guest.sexo },
              { label: 'País de emissão', value: guest.pais_emissao },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{f.label}</span>
                <span className="text-sm font-medium text-right">{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {guest.notas && !editing && (
          <div className="mx-4 rounded-xl border border-border bg-card px-4 py-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Notas</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{guest.notas}</p>
          </div>
        )}

        {/* Booking history */}
        {bookings.length > 0 && (
          <div className="flex flex-col gap-2 px-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Historial de reservas</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {bookings.map(b => {
                const p = props.find(x => x.id === b.propriedade_id)
                const n = nights(b.check_in, b.check_out)
                return (
                  <Link key={b.id} href={`/reservas/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p?.nome ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {n}n</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_CLASS[b.estado]}`}>{STATUS_LABEL[b.estado]}</span>
                        <span className="text-xs text-muted-foreground">{fmtMoney(b.preco_total)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
