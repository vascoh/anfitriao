'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, FileText, Edit2, ArrowRight, MessageCircle } from 'lucide-react'
import { fmtDate, fmtMoney, nights } from '@/lib/store'
import { db } from '@/lib/db'
import type { Guest, Booking, Property } from '@/lib/types'
import { TAG_LABEL, TAG_CLASS, STATUS_LABEL, STATUS_CLASS, SOURCE_LABEL } from '@/lib/labels'
import type { GuestTag } from '@/lib/types'

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
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [dataValidadeDoc, setDataValidadeDoc] = useState('')
  const [sexo, setSexo] = useState('')
  const [paisEmissao, setPaisEmissao] = useState('')
  const [tags, setTags] = useState<GuestTag[]>([])
  const [saveError, setSaveError] = useState('')

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
        setTipoDocumento(g.tipo_documento ?? '')
        setNumeroDocumento(g.numero_documento ?? '')
        setDataNascimento(g.data_nascimento ?? '')
        setDataValidadeDoc(g.data_validade_doc ?? '')
        setSexo(g.sexo ?? '')
        setPaisEmissao(g.pais_emissao ?? '')
        setTags(g.tags)
      }
      setBookings(bookingsAll.filter(b => b.hospede_id === id).sort((a, b) => b.check_in.localeCompare(a.check_in)))
      setProps(propsAll)
    })
  }, [id])

  async function save() {
    if (!guest) return
    setSaveError('')
    const updated: Guest = {
      ...guest,
      nome: nome.trim(),
      email: email.trim() || undefined,
      telefone: telefone.trim() || undefined,
      nacionalidade: nacionalidade.trim() || undefined,
      notas: notas.trim() || undefined,
      tipo_documento: tipoDocumento.trim() || undefined,
      numero_documento: numeroDocumento.trim() || undefined,
      data_nascimento: dataNascimento.trim() || undefined,
      data_validade_doc: dataValidadeDoc.trim() || undefined,
      sexo: sexo.trim() || undefined,
      pais_emissao: paisEmissao.trim() || undefined,
      tags,
    }
    try {
      await db.saveGuest(updated)
      setGuest(updated)
      setEditing(false)
    } catch {
      setSaveError('Erro ao guardar. Tenta novamente.')
    }
  }

  const totalGasto = bookings.filter(b => b.estado !== 'cancelada' && b.estado !== 'no_show').reduce((acc, b) => acc + b.preco_total, 0)
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
        <div className={`grid gap-2.5 px-4 ${numEstadias > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Estadias</p>
            <p className="text-2xl font-bold mt-0.5">{numEstadias}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-2xl font-bold mt-0.5">{fmtMoney(totalGasto)}</p>
          </div>
          {numEstadias > 1 && (
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Média/estadia</p>
              <p className="text-2xl font-bold mt-0.5">{fmtMoney(Math.round(totalGasto / numEstadias))}</p>
            </div>
          )}
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
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TAG_LABEL) as GuestTag[]).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      tags.includes(tag) ? TAG_CLASS[tag] : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                  >
                    {TAG_LABEL[tag]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-1">Dados SIBA</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Tipo de documento</label>
              <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Seleccionar</option>
                <option value="Passaporte">Passaporte</option>
                <option value="Cartão de Cidadão">Cartão de Cidadão</option>
                <option value="BI">BI</option>
                <option value="Título de Residência">Título de Residência</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Nº documento</label>
              <input type="text" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="Ex: AB123456"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-muted-foreground">Data de nascimento</label>
                <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-muted-foreground">Validade doc.</label>
                <input type="date" value={dataValidadeDoc} onChange={e => setDataValidadeDoc(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Sexo</label>
              <div className="flex gap-4 pt-1">
                {['Masculino', 'Feminino'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sexo-edit" value={opt} checked={sexo === opt} onChange={() => setSexo(opt)}
                      className="accent-primary" />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">País de emissão</label>
              <input type="text" value={paisEmissao} onChange={e => setPaisEmissao(e.target.value)} placeholder="Ex: Portugal"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {saveError && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium">Guardar</button>
              <button onClick={() => { setEditing(false); setSaveError('') }} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium">Cancelar</button>
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
            {guest.telefone && (
              <a
                href={`https://wa.me/${guest.telefone.replace(/[^0-9+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Olá ${guest.nome.split(' ')[0]}!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors hover:bg-muted/30"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 font-medium">WhatsApp</span>
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
