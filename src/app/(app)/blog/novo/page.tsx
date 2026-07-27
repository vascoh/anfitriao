'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function NovoPostPage() {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [resumo, setResumo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [imagemCapa, setImagemCapa] = useState('')
  const [publicado, setPublicado] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleTituloChange(v: string) {
    setTitulo(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Erro ao carregar o ficheiro')
      setImagemCapa(json.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o ficheiro')
    } finally {
      setUploading(false)
    }
  }

  const canSave = titulo.trim() && slug.trim() && conteudo.trim()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(), slug: slug.trim(), resumo: resumo.trim() || undefined,
          conteudo: conteudo.trim(), imagem_capa: imagemCapa.trim() || undefined, publicado,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        toast.error(err.error ?? 'Erro ao criar post')
        setSaving(false)
        return
      }
      toast.success('Post criado')
      router.push('/blog')
    } catch {
      toast.error('Erro ao criar post')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/blog" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Novo post</h1>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4 pb-8 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Título *</label>
          <input type="text" value={titulo} onChange={e => handleTituloChange(e.target.value)}
            placeholder="Ex: Como preencher o SIBA em 5 minutos"
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Slug (URL) *</label>
          <div className="flex items-center gap-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-ring">
            <span className="text-muted-foreground shrink-0">/blog/</span>
            <input type="text" value={slug}
              onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
              className="flex-1 bg-transparent focus:outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Resumo (opcional)</label>
          <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={2}
            placeholder="Aparece na lista de posts. Se vazio, usa o início do conteúdo."
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Imagem de capa</label>
          <div className="flex items-center gap-2">
            <input type="url" value={imagemCapa} onChange={e => setImagemCapa(e.target.value)}
              placeholder="https://... ou carrega um ficheiro"
              className="flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <label className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                disabled={uploading} onChange={handleUpload} />
            </label>
          </div>
          {imagemCapa && (
            // eslint-disable-next-line @next/next/no-img-element -- URL arbitrário/preview local, fora do next/image
            <img src={imagemCapa} alt="Preview" className="rounded-lg h-32 w-full object-cover mt-1" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Conteúdo *</label>
          <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={12}
            placeholder="Texto simples. Deixa uma linha em branco entre parágrafos."
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-y font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <button type="button" onClick={() => setPublicado(v => !v)}
          className="flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-3 text-left">
          <div className="flex-1">
            <p className="text-sm font-medium">Publicar no site</p>
            <p className="text-xs text-muted-foreground">
              {publicado ? 'Visível em /blog assim que guardares.' : 'Fica como rascunho, só visível para ti.'}
            </p>
          </div>
          <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${publicado ? 'bg-primary' : 'bg-muted'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${publicado ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </span>
        </button>

        <button onClick={handleSave} disabled={!canSave || saving}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity mt-2">
          {saving ? 'A criar...' : 'Criar post'}
        </button>
      </div>
    </div>
  )
}
