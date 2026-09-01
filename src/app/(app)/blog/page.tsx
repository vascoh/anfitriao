'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Newspaper, Eye, EyeOff } from 'lucide-react'
import { fetchPosts } from '@/lib/fetcher'
import type { Post } from '@/lib/types'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'

export default function BlogPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    fetchPosts()
      .then(setPosts)
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }, [ownerId])

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este post? Não é possível desfazer.')) return
    const res = await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro ao eliminar post')
      return
    }
    setPosts(prev => prev.filter(p => p.id !== id))
    toast.success('Post eliminado')
  }

  if (erro) {
    return <ErroAoCarregar oQue="os artigos" />
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
        </header>
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
        <Link href="/blog/novo"
          className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold active:opacity-80 transition-opacity">
          <Plus className="h-4 w-4" /> Novo post
        </Link>
      </header>

      <div className="max-w-xl flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Posts publicados aparecem em <span className="font-mono">/blog</span> no teu site público.
        </p>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-2xl py-14 px-6 text-center text-muted-foreground">
            <Newspaper className="h-8 w-8" />
            <p className="text-sm">
              Ainda não tens posts. Um artigo sobre a zona — praias, restaurantes,
              como chegar — é o que traz visitas de pesquisa ao teu site.
            </p>
            <Link
              href="/blog/novo"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:opacity-80 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Escrever o primeiro
            </Link>
          </div>
        ) : (
          posts.map(p => (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{p.titulo}</p>
                  <span className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    p.publicado ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                  }`}>
                    {p.publicado ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {p.publicado ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">/blog/{p.slug}</p>
                {p.resumo && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{p.resumo}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/blog/${p.id}/editar`} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                  <Pencil className="h-4 w-4" />
                </Link>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
