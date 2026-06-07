'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { fetchSettings } from '@/lib/fetcher'
import type { WebsiteSettings } from '@/lib/types'

export default function PerfilPage() {
  const { user } = useUser()
  const ownerId = user?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [hostNome, setHostNome] = useState('')
  const [hostBio, setHostBio] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [siteNome, setSiteNome] = useState('')
  const [siteDescricao, setSiteDescricao] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    if (!ownerId) return
    fetchSettings().then(s => {
      if (!s) return
      setHostNome(s.host_nome ?? '')
      setHostBio(s.host_bio ?? '')
      setEmail(s.email ?? '')
      setTelefone(s.telefone ?? '')
      setSiteNome(s.nome ?? '')
      setSiteDescricao(s.descricao ?? '')
      setSlug(s.slug ?? '')
      setLoading(false)
    })
  }, [ownerId])

  async function handleSave() {
    if (!ownerId) return
    setSaving(true)
    try {
      const settings: WebsiteSettings = {
        enabled: true,
        nome: siteNome.trim() || 'Reservas Diretas',
        descricao: siteDescricao.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        min_noites: 1,
        antecedencia_dias: 0,
        host_nome: hostNome.trim() || undefined,
        host_bio: hostBio.trim() || undefined,
        slug: slug.trim() || undefined,
        owner_id: ownerId,
      }
      const res = await fetch('/api/website-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      if (!res.ok) throw new Error()
      toast.success('Perfil guardado')
    } catch {
      toast.error('Erro ao guardar perfil')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        </header>
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      </header>

      <div className="max-w-xl flex flex-col gap-6 p-4">

        {/* Anfitrião */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Anfitrião</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome do anfitrião</label>
            <input type="text" value={hostNome} onChange={e => setHostNome(e.target.value)}
              placeholder="O teu nome (aparece no site de reservas)"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Bio</label>
            <textarea value={hostBio} onChange={e => setHostBio(e.target.value)} rows={3}
              placeholder="Breve apresentação para os teus hóspedes..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Email de contacto</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="reservas@exemplo.pt"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Telefone / WhatsApp</label>
            <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
              placeholder="+351 9XX XXX XXX"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-[10px] text-muted-foreground">Aparece como botão WhatsApp no teu site de reservas.</p>
          </div>
        </section>

        {/* Site de reservas */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Site de reservas diretas</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome do site</label>
            <input type="text" value={siteNome} onChange={e => setSiteNome(e.target.value)}
              placeholder="Ex: Casas da Vinha"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição</label>
            <textarea value={siteDescricao} onChange={e => setSiteDescricao(e.target.value)} rows={2}
              placeholder="Breve descrição para os visitantes do site..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">URL do site</label>
            <div className="flex items-center rounded-lg border border-input bg-card overflow-hidden">
              <span className="px-3 py-2.5 text-sm text-muted-foreground bg-muted border-r border-input shrink-0">anfitrioes.pt/r/</span>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="o-teu-nome"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent placeholder:text-muted-foreground focus:outline-none" />
            </div>
            {slug && (
              <a href={`/r/${slug}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline">
                Ver site → anfitrioes.pt/r/{slug}
              </a>
            )}
          </div>
        </section>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity">
          {saving ? 'A guardar...' : 'Guardar perfil'}
        </button>
      </div>
    </div>
  )
}
