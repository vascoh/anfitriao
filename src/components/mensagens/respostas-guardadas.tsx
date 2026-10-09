'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlus, Loader2, Trash2, X } from 'lucide-react'
import { eliminar, guardarComResposta } from '@/lib/guardar'
import {
  EXEMPLOS, LIMITE_TITULO, VARIAVEIS, preencherModelo,
  type RespostaGuardada, type ValoresVariaveis, type Variavel,
} from '@/lib/respostas-guardadas'

/**
 * Painel de respostas guardadas, por cima do compositor.
 *
 * Escolher uma resposta preenche-a com os dados da conversa e põe-na na caixa
 * de texto — nunca envia. O que faltar fica `[confirmar: …]`, e o envio
 * continua bloqueado até o anfitrião o resolver.
 */
export function RespostasGuardadas({ valores, textoAtual, aoUsar, aoInserirVariavel, aoFechar }: {
  valores: ValoresVariaveis
  textoAtual: string
  aoUsar: (texto: string) => void
  aoInserirVariavel: (variavel: string) => void
  aoFechar: () => void
}) {
  const [respostas, setRespostas] = useState<RespostaGuardada[] | null>(null)
  const [erro, setErro] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const [mostrarVariaveis, setMostrarVariaveis] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/mensagens/respostas')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { respostas: RespostaGuardada[] }) => { if (vivo) setRespostas(d.respostas) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  async function guardarNova(t: string, corpo: string) {
    setAGuardar(true)
    const d = await guardarComResposta<{ resposta: RespostaGuardada }>('/api/mensagens/respostas', { titulo: t, corpo })
    setAGuardar(false)
    if (!d) return false
    setRespostas(prev => [...(prev ?? []), d.resposta].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt')))
    return true
  }

  async function apagar(id: string, nome: string) {
    if (!window.confirm(`Apagar a resposta «${nome}»?`)) return
    if (!await eliminar(`/api/mensagens/respostas?id=${encodeURIComponent(id)}`)) return
    setRespostas(prev => (prev ?? []).filter(r => r.id !== id))
  }

  const semGuardadas = respostas !== null && respostas.length === 0

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col max-h-[50vh]" role="dialog" aria-label="Respostas guardadas">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Respostas guardadas</p>
        <button onClick={aoFechar} className="p-1 rounded text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        {erro && <p className="px-3 py-3 text-xs text-destructive">Não foi possível carregar as respostas.</p>}
        {!erro && respostas === null && (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="A carregar" /></div>
        )}

        {respostas?.map(r => (
          <div key={r.id} className="group flex items-start gap-1 border-b border-border/60 last:border-0">
            <button onClick={() => aoUsar(preencherModelo(r.corpo, valores))}
              className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted/60">
              <p className="text-sm font-medium truncate">{r.titulo}</p>
              <p className="text-xs text-muted-foreground truncate">{r.corpo}</p>
            </button>
            <button onClick={() => apagar(r.id, r.titulo)} aria-label={`Apagar «${r.titulo}»`}
              className="p-2 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {semGuardadas && (
          <>
            <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exemplos para começar</p>
            {EXEMPLOS.map(e => (
              <div key={e.titulo} className="flex items-start gap-1 border-b border-border/60 last:border-0">
                <button onClick={() => aoUsar(preencherModelo(e.corpo, valores))}
                  className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted/60">
                  <p className="text-sm font-medium truncate">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.corpo}</p>
                </button>
                <button onClick={() => guardarNova(e.titulo, e.corpo)} disabled={aGuardar}
                  aria-label={`Guardar «${e.titulo}» nas minhas respostas`} title="Guardar nas minhas respostas"
                  className="p-2 text-muted-foreground hover:text-primary disabled:opacity-40">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
        {textoAtual.trim() ? (
          <form className="flex gap-1.5" onSubmit={async e => {
            e.preventDefault()
            if (await guardarNova(titulo, textoAtual)) setTitulo('')
          }}>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={LIMITE_TITULO}
              placeholder="Nome para guardar o texto escrito" aria-label="Nome da resposta"
              className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs" />
            <button type="submit" disabled={aGuardar || !titulo.trim()}
              className="rounded-lg bg-primary text-primary-foreground px-2.5 text-xs font-semibold disabled:opacity-50">Guardar</button>
          </form>
        ) : (
          <p className="text-[11px] text-muted-foreground">Escreve um texto na caixa para o guardar como resposta.</p>
        )}
        <button onClick={() => setMostrarVariaveis(v => !v)} className="self-start text-[11px] text-primary hover:underline">
          {mostrarVariaveis ? 'Esconder variáveis' : 'Variáveis (preenchidas com os dados da reserva)'}
        </button>
        {mostrarVariaveis && (
          <div className="flex flex-wrap gap-1">
            {(Object.keys(VARIAVEIS) as Variavel[]).map(v => (
              <button key={v} onClick={() => aoInserirVariavel(`{${v}}`)} title={VARIAVEIS[v]}
                className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-mono hover:bg-muted">{`{${v}}`}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
