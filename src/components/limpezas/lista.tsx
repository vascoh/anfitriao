'use client'

import { useState } from 'react'
import { AlertTriangle, Check, MapPin, Undo2, Users, Zap } from 'lucide-react'
import { addDays } from '@/lib/utils'
import { porConfirmar, LIMITE_NOTA, type EstadoLimpeza, type Limpeza } from '@/lib/limpezas'

export interface UnidadeVista { id: string; nome: string; morada: string; cor: string }

export type Marcar = (l: Limpeza, estado: EstadoLimpeza, nota: string | null) => Promise<boolean>

function rotuloDia(data: string, hoje: string): string {
  if (data === hoje) return 'Hoje'
  if (data === addDays(hoje, 1)) return 'Amanhã'
  if (data === addDays(hoje, -1)) return 'Ontem'
  const [a, m, d] = data.split('-').map(Number)
  const txt = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(a, m - 1, d)))
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function textoEntrada(l: Limpeza, hoje: string): string {
  if (!l.entrada) return 'Sem entrada marcada'
  const quem = l.entrada.hospedes ? `${l.entrada.hospedes} hóspede${l.entrada.hospedes !== 1 ? 's' : ''}` : 'quarto fechado'
  const noites = l.entrada.noites ? `, ${l.entrada.noites} noite${l.entrada.noites !== 1 ? 's' : ''}` : ''
  if (l.mesmoDia) return `Entram no mesmo dia: ${quem}${noites}`
  const quando = l.entrada.data === addDays(l.data, 1) ? 'no dia seguinte' : rotuloDia(l.entrada.data, hoje).toLowerCase()
  return `Próxima entrada ${quando}: ${quem}${noites}`
}

function Item({ l, u, hoje, onMarcar, mostrarMorada }: {
  l: Limpeza; u: UnidadeVista | undefined; hoje: string; onMarcar: Marcar; mostrarMorada: boolean
}) {
  const [aEscrever, setAEscrever] = useState(false)
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const futura = l.data > addDays(hoje, 1)
  const atrasada = porConfirmar(l, hoje)

  async function marcar(estado: EstadoLimpeza, n: string | null) {
    setOcupado(true)
    const ok = await onMarcar(l, estado, n)
    setOcupado(false)
    if (ok) { setAEscrever(false); setNota('') }
  }

  return (
    <li className={`px-4 lg:px-8 py-3 flex flex-col gap-2 ${l.estado === 'feita' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: u?.cor ?? '#C2714F' }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{u?.nome ?? 'Quarto'}</p>
          {mostrarMorada && u?.morada && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(u.morada)}`} target="_blank" rel="noreferrer"
              className="text-xs text-muted-foreground flex items-center gap-1 hover:underline">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />{u.morada}
            </a>
          )}
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${l.mesmoDia ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
            {l.mesmoDia ? <Zap className="h-3 w-3 shrink-0" aria-hidden /> : <Users className="h-3 w-3 shrink-0" aria-hidden />}
            {textoEntrada(l, hoje)}
          </p>
          {l.incerta && (
            <p className="text-xs text-amber-700 mt-0.5">Fecho vindo do calendário: confirma se houve hóspede.</p>
          )}
          {atrasada && <p className="text-xs text-amber-700 mt-0.5">Ficou por marcar. Já está feita?</p>}
          {l.estado === 'problema' && l.nota && (
            <p className="text-xs text-destructive mt-1 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
              <span>{l.nota}{l.por ? ` · ${l.por}` : ''}</span>
            </p>
          )}
          {l.estado === 'feita' && (
            <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
              <Check className="h-3 w-3" aria-hidden />Feita{l.por ? ` · ${l.por}` : ''}
            </p>
          )}
        </div>
        {!futura && (
          <div className="flex items-center gap-1.5 shrink-0">
            {l.estado === 'por_fazer' ? (
              <>
                <button disabled={ocupado} onClick={() => setAEscrever(v => !v)}
                  className="rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                  aria-expanded={aEscrever}>
                  Problema
                </button>
                <button disabled={ocupado} onClick={() => marcar('feita', null)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" aria-hidden />Feita
                </button>
              </>
            ) : (
              <button disabled={ocupado} onClick={() => marcar('por_fazer', null)}
                className="rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-1">
                <Undo2 className="h-3.5 w-3.5" aria-hidden />Desfazer
              </button>
            )}
          </div>
        )}
      </div>
      {aEscrever && (
        <form className="flex flex-col gap-2 pl-5"
          onSubmit={e => { e.preventDefault(); if (nota.trim()) marcar('problema', nota.trim()) }}>
          <label className="text-xs text-muted-foreground" htmlFor={`nota-${l.chave}`}>O que se passa?</label>
          <textarea id={`nota-${l.chave}`} value={nota} onChange={e => setNota(e.target.value)} maxLength={LIMITE_NOTA} rows={2}
            placeholder="Ex.: falta roupa de cama, torneira a pingar"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAEscrever(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancelar</button>
            <button type="submit" disabled={ocupado || !nota.trim()}
              className="rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              Avisar
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

/** Lista de limpezas agrupada por dia. Os dias passados só aparecem com algo por confirmar. */
export function ListaLimpezas({ limpezas, unidades, hoje, onMarcar, mostrarMorada = false, vazio }: {
  limpezas: Limpeza[]
  unidades: Record<string, UnidadeVista>
  hoje: string
  onMarcar: Marcar
  mostrarMorada?: boolean
  vazio: React.ReactNode
}) {
  const visiveis = limpezas.filter(l => l.data >= hoje || l.estado !== 'feita')
  if (!visiveis.length) return <>{vazio}</>

  const dias = new Map<string, Limpeza[]>()
  for (const l of visiveis) {
    const lista = dias.get(l.data) ?? []
    lista.push(l)
    dias.set(l.data, lista)
  }

  return (
    <div className="flex flex-col">
      {[...dias.entries()].map(([data, ls]) => {
        const porFazer = ls.filter(l => l.estado !== 'feita').length
        return (
          <section key={data} className="border-b border-border">
            <div className="flex items-center justify-between px-4 lg:px-8 pt-5 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{rotuloDia(data, hoje)}</h2>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {porFazer ? `${porFazer} por fazer` : 'Tudo feito'}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {ls.map(l => (
                <Item key={l.chave} l={l} u={unidades[l.propriedade_id]} hoje={hoje} onMarcar={onMarcar} mostrarMorada={mostrarMorada} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
