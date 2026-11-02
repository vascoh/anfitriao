'use client'

import { useCallback, useEffect, useState } from 'react'
import { BrushCleaning, CalendarPlus, RefreshCw } from 'lucide-react'
import type { EstadoLimpeza, Limpeza } from '@/lib/limpezas'
import { ListaLimpezas, type UnidadeVista } from '@/components/limpezas/lista'

interface Resposta { nome: string; hoje: string; limpezas: Limpeza[]; unidades: Record<string, UnidadeVista> }

export function EquipaLimpezas({ token }: { token: string }) {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipa/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErro(json?.error ?? 'Não foi possível carregar.'); return }
      setDados(json)
      setErro(null)
    } catch {
      setErro('Sem ligação. Tenta outra vez.')
    }
  }, [token])

  useEffect(() => {
    const t0 = setTimeout(() => { carregar() }, 0)
    // A lista muda quando entra uma reserva nova: atualiza ao voltar à página.
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearTimeout(t0); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [carregar])

  async function marcar(l: Limpeza, estado: EstadoLimpeza, nota: string | null): Promise<boolean> {
    setAviso(null)
    try {
      const res = await fetch(`/api/equipa/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propriedade_id: l.propriedade_id, data: l.data, estado, nota }),
      })
      if (!res.ok) {
        setAviso((await res.json().catch(() => null))?.error ?? 'Não foi possível gravar.')
        return false
      }
    } catch {
      setAviso('Sem ligação. Não ficou gravado.')
      return false
    }
    setDados(d => d && {
      ...d,
      limpezas: d.limpezas.map(x => x.chave === l.chave
        ? { ...x, estado, nota, por: estado === 'por_fazer' ? null : d.nome }
        : x),
    })
    if (estado === 'problema') setAviso('Problema enviado ao anfitrião.')
    return true
  }

  if (erro && !dados) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center bg-background">
        <BrushCleaning className="h-8 w-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm text-foreground font-medium">{erro}</p>
        <button onClick={carregar} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Tentar outra vez</button>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background pb-10">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Limpezas</h1>
            <p className="text-sm text-muted-foreground">{dados ? `Olá, ${dados.nome}` : 'A carregar…'}</p>
          </div>
          <button onClick={carregar} aria-label="Atualizar" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {aviso && (
          <p role="status" className="mx-4 mt-4 rounded-lg bg-muted px-3 py-2 text-sm">{aviso}</p>
        )}
        {!dados ? (
          <ul className="animate-pulse" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-4 py-3 border-b border-border flex flex-col gap-2">
                <div className="h-3.5 w-40 rounded bg-muted" /><div className="h-3 w-56 rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : (
          <ListaLimpezas
            limpezas={dados.limpezas}
            unidades={dados.unidades}
            hoje={dados.hoje}
            onMarcar={marcar}
            mostrarMorada
            vazio={<p className="px-6 py-16 text-center text-sm text-muted-foreground">Nada marcado para as próximas três semanas.</p>}
          />
        )}

        <div className="px-4 pt-8">
          <button
            onClick={() => { window.location.href = `webcal://${window.location.host}/api/equipa/${encodeURIComponent(token)}/ical` }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />Pôr no calendário do telemóvel
          </button>
        </div>
      </div>
    </main>
  )
}
