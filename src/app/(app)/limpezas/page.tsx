'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { BrushCleaning, CalendarPlus, Copy, Link2, MessageCircle, Trash2, UserPlus, Zap } from 'lucide-react'
import { addDays, today } from '@/lib/utils'
import { fetchProperties } from '@/lib/fetcher'
import { ordenarComQuartos } from '@/lib/reservations'
import type { Limpeza, EstadoLimpeza } from '@/lib/limpezas'
import type { Property } from '@/lib/types'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import { ListaLimpezas, type UnidadeVista } from '@/components/limpezas/lista'

interface Plano { limpezas: Limpeza[]; unidades: Record<string, UnidadeVista> }
interface Acesso { id: string; nome: string; propriedade_ids: string[]; criado_em: string; ultimo_acesso: string | null }

function quandoAcedeu(iso: string | null): string {
  if (!iso) return 'Ainda não abriu o link'
  const d = new Date(iso)
  return `Abriu a ${new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)}`
}

export default function LimpezasPage() {
  const { user } = useUser()
  const [plano, setPlano] = useState<Plano | null>(null)
  const [erro, setErro] = useState(false)
  const [props, setProps] = useState<Property[]>([])
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [hoje] = useState(today)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/limpezas')
      if (!res.ok) throw new Error(String(res.status))
      setPlano(await res.json())
      setErro(false)
    } catch {
      setErro(true)
    }
  }, [])

  const carregarAcessos = useCallback(async () => {
    const res = await fetch('/api/limpezas/equipa')
    if (res.ok) setAcessos((await res.json()).acessos ?? [])
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const t = setTimeout(() => {
      carregar()
      carregarAcessos()
      fetchProperties().then(setProps)
    }, 0)
    return () => clearTimeout(t)
  }, [user?.id, carregar, carregarAcessos])

  async function marcar(l: Limpeza, estado: EstadoLimpeza, nota: string | null): Promise<boolean> {
    const res = await fetch('/api/limpezas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propriedade_id: l.propriedade_id, data: l.data, estado, nota }),
    })
    if (!res.ok) {
      toast.error((await res.json().catch(() => null))?.error ?? 'Não foi possível gravar.')
      return false
    }
    setPlano(p => p && {
      ...p,
      limpezas: p.limpezas.map(x => x.chave === l.chave
        ? { ...x, estado, nota, por: estado === 'por_fazer' ? null : 'Anfitrião' }
        : x),
    })
    return true
  }

  const resumo = useMemo(() => {
    const ls = plano?.limpezas ?? []
    const deHoje = ls.filter(l => l.data === hoje)
    return {
      hoje: deHoje.filter(l => l.estado !== 'feita').length,
      mesmoDia: deHoje.filter(l => l.mesmoDia && l.estado !== 'feita').length,
      semana: ls.filter(l => l.data > hoje && l.data <= addDays(hoje, 7)).length,
      problemas: ls.filter(l => l.estado === 'problema').length,
    }
  }, [plano, hoje])

  return (
    <div className="flex flex-col min-h-full pb-6">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">Limpezas</h1>
          <p className="text-sm text-muted-foreground">Cada saída é um quarto por arrumar. Partilha a lista com quem limpa.</p>
        </div>
        {plano && (
          <div className="flex items-center border-t border-border divide-x divide-border text-sm max-w-5xl overflow-x-auto">
            <div className="flex items-center gap-2 px-4 lg:px-8 py-2.5 shrink-0">
              <BrushCleaning className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="font-semibold">{resumo.hoje}</span>
              <span className="text-muted-foreground">hoje</span>
            </div>
            {resumo.mesmoDia > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
                <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-semibold text-primary">{resumo.mesmoDia}</span>
                <span className="text-muted-foreground">com entrada no mesmo dia</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <span className="font-semibold">{resumo.semana}</span>
              <span className="text-muted-foreground">nos próximos 7 dias</span>
            </div>
            {resumo.problemas > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0">
                <span className="font-semibold text-destructive">{resumo.problemas}</span>
                <span className="text-muted-foreground">com problema</span>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="max-w-5xl w-full">
        {erro && !plano ? (
          <ErroAoCarregar oQue="as limpezas" aviso="Não assumas que não há quartos por arrumar." aoTentar={carregar} />
        ) : !plano ? (
          <ul className="animate-pulse" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-4 lg:px-8 py-3 border-b border-border flex flex-col gap-2">
                <div className="h-3.5 w-40 rounded bg-muted" /><div className="h-3 w-56 rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : (
          <ListaLimpezas
            limpezas={plano.limpezas}
            unidades={plano.unidades}
            hoje={hoje}
            onMarcar={marcar}
            vazio={
              <div className="flex flex-col items-center text-center gap-2 px-6 py-16 text-sm text-muted-foreground">
                <BrushCleaning className="h-8 w-8 text-muted-foreground/60" aria-hidden />
                <p className="font-medium text-foreground">Sem saídas nos próximos 30 dias</p>
                <p className="max-w-xs">As limpezas aparecem sozinhas a partir das reservas, incluindo as que entram pelos calendários do Airbnb e da Booking.com.</p>
              </div>
            }
          />
        )}

        <Equipa acessos={acessos} props={props} onMudou={carregarAcessos} />
      </div>
    </div>
  )
}

function Equipa({ acessos, props, onMudou }: { acessos: Acesso[]; props: Property[]; onMudou: () => void }) {
  const [aCriar, setACriar] = useState(false)
  const [nome, setNome] = useState('')
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [novo, setNovo] = useState<{ nome: string; url: string } | null>(null)

  // Escolhe-se ao nível da casa ou do apartamento; os quartos vêm com a casa.
  const topo = useMemo(() => ordenarComQuartos(props).filter(p => !p.parent_id && p.ativo), [props])
  const nomes = useMemo(() => new Map(props.map(p => [p.id, p.nome])), [props])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    const res = await fetch('/api/limpezas/equipa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, propriedade_ids: escolhidas }),
    })
    const json = await res.json().catch(() => null)
    setOcupado(false)
    if (!res.ok) { toast.error(json?.error ?? 'Não foi possível criar o link.'); return }
    setNovo({ nome: json.acesso.nome, url: `${window.location.origin}/equipa/${json.token}` })
    setACriar(false); setNome(''); setEscolhidas([])
    onMudou()
  }

  async function revogar(a: Acesso) {
    if (!confirm(`Desligar o link de ${a.nome}? Deixa de abrir de imediato.`)) return
    const res = await fetch(`/api/limpezas/equipa?id=${a.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Não foi possível desligar o link.'); return }
    toast.success('Link desligado.')
    onMudou()
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); toast.success('Copiado.') }
    catch { toast.error('Não foi possível copiar. Seleciona o texto à mão.') }
  }

  const mensagem = novo
    ? `Olá ${novo.nome.split(/[\s—-]/)[0]}! Aqui tens a lista de limpezas, sempre atualizada: ${novo.url}\nQuando acabares um quarto, carrega em «Feita».`
    : ''

  return (
    <section className="px-4 lg:px-8 pt-8 flex flex-col gap-3" aria-labelledby="equipa-titulo">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id="equipa-titulo" className="text-base font-semibold">Equipa de limpeza</h2>
          <p className="text-xs text-muted-foreground">Um link sem login por pessoa. Vê quartos, moradas e quantas pessoas entram: nunca nomes, contactos ou preços.</p>
        </div>
        {!aCriar && (
          <button onClick={() => { setACriar(true); setNovo(null) }}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />Novo link
          </button>
        )}
      </div>

      {novo && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">Link de {novo.nome} pronto</p>
          <p className="text-xs text-muted-foreground">Só o vês agora. Se o perderes, cria outro e desliga este.</p>
          <code className="text-xs break-all rounded-lg bg-background border border-border px-3 py-2">{novo.url}</code>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />Enviar por WhatsApp
            </a>
            <button onClick={() => copiar(novo.url)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-muted">
              <Copy className="h-3.5 w-3.5" aria-hidden />Copiar link
            </button>
            <button onClick={() => copiar(`${novo.url.replace('/equipa/', '/api/equipa/')}/ical`)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-muted">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden />Copiar calendário (Google, iPhone)
            </button>
          </div>
        </div>
      )}

      {aCriar && (
        <form onSubmit={criar} className="rounded-xl border border-border p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Para quem
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} required autoFocus
              placeholder="Ex.: Maria"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          {topo.length > 1 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-muted-foreground mb-1">Que alojamentos (nenhum marcado = todos)</legend>
              {topo.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={escolhidas.includes(p.id)}
                    onChange={e => setEscolhidas(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))} />
                  {p.nome}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setACriar(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancelar</button>
            <button type="submit" disabled={ocupado || !nome.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              Criar link
            </button>
          </div>
        </form>
      )}

      {acessos.length > 0 && (
        <ul className="rounded-xl border border-border divide-y divide-border">
          {acessos.map(a => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.propriedade_ids.length ? a.propriedade_ids.map(id => nomes.get(id) ?? '?').join(', ') : 'Todos os alojamentos'}
                  {' · '}{quandoAcedeu(a.ultimo_acesso)}
                </p>
              </div>
              <button onClick={() => revogar(a)} aria-label={`Desligar o link de ${a.nome}`}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
