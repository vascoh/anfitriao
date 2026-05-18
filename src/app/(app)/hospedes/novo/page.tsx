'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { uuid } from '@/lib/store'
import { db } from '@/lib/db'
import type { Guest } from '@/lib/types'

export default function NovoHospedePage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nacionalidade, setNacionalidade] = useState('')
  const [notas, setNotas] = useState('')

  async function handleSave() {
    if (!nome.trim()) return
    const g: Guest = {
      id: uuid(),
      nome: nome.trim(),
      email: email.trim() || undefined,
      telefone: telefone.trim() || undefined,
      nacionalidade: nacionalidade.trim() || undefined,
      notas: notas.trim() || undefined,
      tags: ['novo'],
      criado_em: new Date().toISOString(),
    }
    await db.saveGuest(g)
    router.push(`/hospedes/${g.id}`)
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/hospedes" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Novo hóspede</h1>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {[
          { label: 'Nome completo *', value: nome, set: setNome, type: 'text', placeholder: 'Ex: Emma Schmidt' },
          { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'email@exemplo.com' },
          { label: 'Telefone', value: telefone, set: setTelefone, type: 'tel', placeholder: '+49 151 2345 6789' },
          { label: 'Nacionalidade', value: nacionalidade, set: setNacionalidade, type: 'text', placeholder: 'Ex: Alemã' },
        ].map(f => (
          <div key={f.label} className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">{f.label}</label>
            <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Preferências, observações..."
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-24 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={handleSave} disabled={!nome.trim()}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity mt-2">
          Criar hóspede
        </button>
      </div>
    </div>
  )
}
