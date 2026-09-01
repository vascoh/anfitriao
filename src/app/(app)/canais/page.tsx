'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import {
  RefreshCw, Trash2, Check, Copy, Plus, ArrowLeft, ArrowRight,
  AlertCircle, Loader2, Building2, Download, Upload, Info, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchProperties } from '@/lib/fetcher'
import { ordenarComQuartos } from '@/lib/reservations'
import type { Property, IcalFeed, BookingSource } from '@/lib/types'
import { SOURCE_LABEL, SOURCE_COLOR } from '@/lib/labels'
import {
  GUIAS, GUIAS_EXPORTAR, GUIA_AMENITIZ, AVISO_FONTE_DUPLICADA,
  deveAvisarDuplicacao, eGestorDeCanais,
} from '@/lib/ical-guias'
import {
  estadoDoFeed, estadoDoAlojamento, erroAmigavel, ESTADO_CANAL,
  O_QUE_SINCRONIZA, O_QUE_NAO_SINCRONIZA, CANAIS_IMPORTAVEIS,
  type EstadoCanal,
} from '@/lib/canais'

/* ── Crachá de estado ──────────────────────────────────────────────────────
 *
 * O anfitrião perguntou-nos, por palavras dele, «isto está a funcionar?». A
 * resposta tem de caber num relance e nunca ser só uma cor: um verde sozinho
 * não se distingue de um cinzento em ecrãs maus, à luz do sol, ou para quem
 * não distingue as duas. Por isso cor **e** palavra, sempre. */

const TOM_CLASSE: Record<string, string> = {
  verde: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ambar: 'bg-amber-50 text-amber-900 border-amber-200',
  vermelho: 'bg-red-50 text-red-700 border-red-200',
  neutro: 'bg-muted text-muted-foreground border-border',
}

const TOM_PONTO: Record<string, string> = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  vermelho: 'bg-red-500',
  neutro: 'bg-muted-foreground/40',
}

function CrachaEstado({ estado, className = '' }: { estado: EstadoCanal; className?: string }) {
  const d = ESTADO_CANAL[estado]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TOM_CLASSE[d.tom]} ${className}`}
      title={d.explicacao}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TOM_PONTO[d.tom]}`} aria-hidden />
      {d.label}
    </span>
  )
}

function dataLegivel(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

/* ── O que é isto, afinal ─────────────────────────────────────────────────── */

function ComoFunciona() {
  return (
    <details className="rounded-2xl border border-border bg-card px-4 py-3.5" open>
      <summary className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
        <Info className="h-4 w-4 text-primary shrink-0" />
        Como funciona a ligação aos canais
      </summary>

      <div className="mt-3.5 flex flex-col gap-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">
          O Anfitrião liga-se ao Airbnb e ao Booking.com através de <strong className="text-foreground">calendários iCal</strong> —
          o formato que todas as plataformas usam para trocar datas ocupadas entre si.
          Não é uma ligação oficial por API: ninguém entra na tua conta do Airbnb.
          São dois endereços de internet que tu copias de um lado e colas no outro.
        </p>

        <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            São dois sentidos, e precisas dos dois
          </p>
          <div className="flex flex-col gap-2 text-[13px]">
            <p><strong>1. Importar</strong> — trazes o calendário do Airbnb para cá. As reservas que recebes lá aparecem aqui e ocupam as datas.</p>
            <p><strong>2. Exportar</strong> — levas o calendário do Anfitrião para lá. As datas ocupadas aqui passam a estar bloqueadas no Airbnb.</p>
          </div>
          <p className="mt-2.5 text-xs text-amber-800 leading-relaxed">
            Só com os dois é que ficas protegido de vender a mesma noite duas vezes.
            Fazer só a importação é o erro mais comum — e só se dá por ele quando aparecem dois hóspedes à porta no mesmo dia.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1.5">O que é sincronizado</p>
            <ul className="flex flex-col gap-1">
              {O_QUE_SINCRONIZA.map(t => (
                <li key={t} className="text-[13px] text-muted-foreground flex gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />{t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700 mb-1.5">O que NÃO é sincronizado</p>
            <ul className="flex flex-col gap-1">
              {O_QUE_NAO_SINCRONIZA.map(t => (
                <li key={t} className="text-[13px] text-muted-foreground flex gap-1.5">
                  <span className="text-red-500 shrink-0 mt-0.5 leading-none">✕</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
          A limitação dos preços é do <strong>formato</strong>, não desta aplicação: o iCal só transporta datas.
          Nenhuma ferramenta consegue sincronizar preços por iCal — quem o promete está a usar outra coisa por baixo.
          Os preços continuam a definir-se em cada plataforma.
        </p>
      </div>
    </details>
  )
}

/* ── Passo 3 do assistente: colar e testar ────────────────────────────────── */

function AssistenteLigar({
  prop, feeds, aoLigar,
}: {
  prop: Property
  feeds: IcalFeed[]
  aoLigar: () => Promise<void>
}) {
  const [aberto, setAberto] = useState(false)
  const [passo, setPasso] = useState<1 | 2>(1)
  const [fonte, setFonte] = useState<BookingSource>('airbnb')
  const [url, setUrl] = useState('')
  const [aLigar, setALigar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const guia = fonte === 'outro' ? GUIA_AMENITIZ : GUIAS[fonte as keyof typeof GUIAS]
  const avisoDuplicacao = deveAvisarDuplicacao(feeds.map(f => f.url), fonte)

  function fechar() {
    setAberto(false); setPasso(1); setUrl(''); setErro(null)
  }

  async function ligar() {
    setALigar(true); setErro(null)
    try {
      const res = await fetch('/api/canais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: prop.id, url: url.trim(), source: fonte }),
      })
      const data = await res.json()
      if (!res.ok) {
        /* Só a falha de **leitura do feed** passa pelo tradutor.
         *
         * `erroAmigavel` traduz mensagens técnicas de fetch — 404, timeout,
         * ligação recusada — e o que não reconhece devolve como «A leitura
         * falhou: …». Aplicá-lo a tudo dava frases falsas nas recusas que a
         * própria rota já escreve em português: «A leitura falhou: Demasiadas
         * tentativas de ligação» quando não houve leitura nenhuma, ou o mesmo
         * por cima de «Este calendário já está ligado a este alojamento».
         *
         * A rota marca as falhas de leitura com `teste: 'falhou'` — é essa a
         * fronteira. */
        setErro(data.teste === 'falhou'
          ? erroAmigavel(data.error ?? '')
          : data.error ?? 'Não foi possível ligar este calendário.')
        return
      }
      toast.success(
        data.eventos > 0
          ? `Ligado. O calendário tem ${data.eventos} ${data.eventos === 1 ? 'data ocupada' : 'datas ocupadas'}.`
          : 'Ligado. O calendário está vazio de momento — é normal se ainda não tens reservas lá.',
      )
      fechar()
      await aoLigar()
    } catch {
      setErro('Não foi possível falar com o servidor. Verifica a ligação à internet.')
    } finally {
      setALigar(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Ligar uma plataforma
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          Passo {passo} de 2
        </span>
        <span className="text-[11px] text-muted-foreground">
          {passo === 1 ? 'Escolher a plataforma' : `Ir buscar o endereço ao ${guia?.label ?? ''}`}
        </span>
        <button onClick={fechar} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>

      {passo === 1 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CANAIS_IMPORTAVEIS.map(c => (
              <button
                key={c}
                onClick={() => setFonte(c)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                  fonte === c ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLOR[c] }} aria-hidden />
                <span className="truncate">{c === 'outro' ? 'Gestor de canais' : SOURCE_LABEL[c]}</span>
              </button>
            ))}
          </div>

          {avisoDuplicacao && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
              {AVISO_FONTE_DUPLICADA}
            </p>
          )}

          <button
            onClick={() => setPasso(2)}
            className="self-start flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:opacity-80 transition-opacity"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </>
      )}

      {passo === 2 && guia && (
        <>
          <div className="rounded-xl border border-border bg-card px-3.5 py-3">
            <p className="text-xs font-semibold mb-2">Onde encontrar o endereço no {guia.label}</p>
            <ol className="flex flex-col gap-1.5 list-decimal list-inside">
              {guia.passos.map(p => (
                <li key={p} className="text-[13px] text-muted-foreground leading-relaxed">{p}</li>
              ))}
            </ol>
            <p className="mt-2.5 text-[11px] text-muted-foreground break-all">
              Deve parecer-se com <code className="font-mono">{guia.exemploUrl}</code>
            </p>
            {guia.notas?.map(n => (
              <p key={n} className="mt-1.5 text-[11px] text-amber-800 leading-relaxed">{n}</p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`url-${prop.id}`} className="text-xs font-semibold">
              Cola aqui o endereço do calendário do {guia.label}
            </label>
            <input
              id={`url-${prop.id}`}
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setErro(null) }}
              placeholder="https://…"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Ao ligar, o endereço é testado logo — se estiver errado, ficas a saber já e não daqui a um dia.
            </p>
          </div>

          {erro && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 mt-px" aria-hidden />
              <span>{erro}</span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPasso(1)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              onClick={ligar}
              disabled={!url.trim() || aLigar}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 active:opacity-80 transition-opacity"
            >
              {aLigar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {aLigar ? 'A testar…' : 'Testar e ligar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Exportar: o endereço que se cola nas plataformas ─────────────────────── */

function PainelExportar({ prop }: { prop: Property }) {
  const [copiado, setCopiado] = useState(false)
  const [plataforma, setPlataforma] = useState<BookingSource>('airbnb')
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/api/ical/${prop.id}`
  const guia = GUIAS_EXPORTAR[plataforma as keyof typeof GUIAS_EXPORTAR]

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('O browser não deixou copiar. Seleciona o endereço e copia à mão.')
    }
  }

  return (
    <details className="rounded-xl border border-border bg-card px-3.5 py-3">
      <summary className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
        <Upload className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        Levar as tuas datas para as plataformas
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Este é o endereço do calendário deste alojamento. Cola-o em cada plataforma
          para que as datas ocupadas aqui — incluindo as reservas do teu próprio site — fiquem bloqueadas lá.
        </p>

        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={e => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-lg border border-input bg-muted/40 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Endereço do calendário deste alojamento"
          />
          <button
            onClick={copiar}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:bg-muted transition-colors shrink-0"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CANAIS_IMPORTAVEIS.map(c => (
            <button
              key={c}
              onClick={() => setPlataforma(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                plataforma === c ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c === 'outro' ? 'Outra' : SOURCE_LABEL[c]}
            </button>
          ))}
        </div>

        {guia && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-semibold mb-1.5">Onde colar no {guia.label}</p>
            <ol className="flex flex-col gap-1 list-decimal list-inside">
              {guia.passos.map(p => (
                <li key={p} className="text-[13px] text-muted-foreground leading-relaxed">{p}</li>
              ))}
            </ol>
            {guia.notas?.map(n => (
              <p key={n} className="mt-1.5 text-[11px] text-amber-800 leading-relaxed">{n}</p>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

/* ── Casa dividida em quartos: o que é preciso fazer ───────────────────────── */

/**
 * O que fazer quando a casa está dividida em quartos.
 *
 * O cartão da casa dizia só «liga os calendários quarto a quarto, em baixo», e
 * ficava-se por aí. Quem tem os quartos criados fica com duas perguntas por
 * responder, e são perguntas com respostas **diferentes**: o site de reservas
 * não precisa de nada (a casa já mostra os quartos sozinha) e as plataformas
 * precisam de tudo (um anúncio por quarto, e os dois sentidos em cada um).
 *
 * Deixar as duas sem resposta no mesmo ecrã leva ao pior dos enganos: assumir
 * que ligar a casa chega, e vender o mesmo quarto duas vezes.
 */
function GuiaCasaComQuartos({ casa, quartos }: { casa: Property; quartos: Property[] }) {
  const n = quartos.length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Esta casa está dividida em <strong className="text-foreground">{n} {n === 1 ? 'quarto' : 'quartos'}</strong>,
        e as reservas vivem em cada quarto — não na casa. O que é preciso fazer
        é diferente de um lado e do outro:
      </p>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          No teu site de reservas — já está feito
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          Não tens nada a configurar. Os quartos não aparecem como alojamentos
          soltos: aparece <strong className="text-foreground">{casa.nome}</strong>, e
          quem a abrir escolhe entre reservar a casa inteira ou só um quarto. Um
          quarto já ocupado aparece indisponível nessas datas.
        </p>
        <Link
          href={`/book/${casa.id}`}
          target="_blank"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver como aparece aos hóspedes <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          Nas plataformas — um anúncio por quarto, e dois sentidos em cada
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          No Airbnb e no Booking.com cada quarto é um anúncio próprio. A ligação
          faz-se <strong className="text-foreground">dentro do cartão de cada quarto</strong>,
          aqui em baixo — não neste cartão da casa. Em cada um:
        </p>
        <ol className="mt-2 flex flex-col gap-1.5 list-decimal list-inside">
          <li className="text-[13px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Trazer</strong> — no anúncio desse quarto na
            plataforma, copia o endereço iCal e cola-o em «Ligar uma plataforma», no cartão do quarto.
          </li>
          <li className="text-[13px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Levar</strong> — copia o endereço do quarto
            (em «Levar as tuas datas para as plataformas», dentro do cartão dele) e cola-o
            no mesmo anúncio, na plataforma.
          </li>
        </ol>
        <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
          Repete para {n === 1 ? 'o quarto' : `os ${n} quartos`}: {quartos.map(q => q.nome).join(', ')}.
          Só com os dois sentidos é que uma noite vendida num lado fica bloqueada no outro.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-xs font-semibold text-amber-900">Se também anuncias a casa inteira</p>
        <p className="mt-1.5 text-[13px] text-amber-900/90 leading-relaxed">
          O endereço desta casa — em «Levar as tuas datas», aqui em baixo — junta
          a ocupação {n === 1 ? 'do quarto' : `dos ${n} quartos`} num só calendário.
          Cola-o no anúncio da casa inteira e um quarto vendido passa a bloquear a casa.
        </p>
        <p className="mt-2 text-[13px] text-amber-900/90 leading-relaxed">
          <strong>O contrário ainda não acontece:</strong> uma reserva da casa inteira
          feita numa plataforma não é trazida para aqui nem bloqueia os quartos — por
          isso é que este cartão não tem «Ligar uma plataforma». Enquanto for assim,
          bloqueia os quartos à mão quando venderes a casa inteira por fora.
        </p>
      </div>
    </div>
  )
}

/* ── Cartão de um alojamento ──────────────────────────────────────────────── */

function CartaoAlojamento({
  prop, eContentor, quartos, recarregar,
}: {
  prop: Property
  /** Casa cujas reservas vivem nos quartos — não leva feeds próprios. */
  eContentor: boolean
  /** Os quartos desta casa, quando é contentor. */
  quartos: Property[]
  recarregar: () => Promise<void>
}) {
  const feeds = useMemo(() => prop.ical_feeds ?? [], [prop.ical_feeds])
  const [aSincronizar, setASincronizar] = useState(false)
  const [aRemover, setARemover] = useState<string | null>(null)
  const [confirmarRemover, setConfirmarRemover] = useState<string | null>(null)
  const estado = estadoDoAlojamento(feeds)

  async function sincronizar() {
    setASincronizar(true)
    try {
      const res = await fetch('/api/ical-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: prop.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'A sincronização falhou.')
        return
      }
      const falhas = (data.results ?? []).filter((r: { error?: string }) => r.error)
      if (falhas.length > 0) {
        toast.error(`${falhas.length} ${falhas.length === 1 ? 'canal falhou' : 'canais falharam'}. Vê o detalhe em baixo.`)
      } else {
        toast.success(
          data.synced > 0
            ? `${data.synced} ${data.synced === 1 ? 'reserva nova importada' : 'reservas novas importadas'}.`
            : 'Sincronizado. Não havia nada de novo.',
        )
      }
      await recarregar()
    } catch {
      toast.error('Não foi possível falar com o servidor.')
    } finally {
      setASincronizar(false)
    }
  }

  async function remover(feedId: string) {
    setARemover(feedId)
    try {
      const res = await fetch(`/api/canais?propertyId=${prop.id}&feedId=${feedId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Não foi possível desligar.')
        return
      }
      toast.success(
        data.reservasMantidas > 0
          ? `Canal desligado. As ${data.reservasMantidas} reservas já importadas ficaram — só deixam de chegar novidades.`
          : 'Canal desligado.',
      )
      setConfirmarRemover(null)
      await recarregar()
    } catch {
      toast.error('Não foi possível falar com o servidor.')
    } finally {
      setARemover(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: prop.cor }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{prop.nome}</p>
          {prop.parent_id && <p className="text-[11px] text-muted-foreground">Quarto</p>}
        </div>
        {!eContentor && <CrachaEstado estado={estado} />}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {eContentor ? (
          <GuiaCasaComQuartos casa={prop} quartos={quartos} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" aria-hidden />
                Trazer reservas para cá
              </p>
              {feeds.length > 0 && (
                <button
                  onClick={sincronizar}
                  disabled={aSincronizar}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${aSincronizar ? 'animate-spin' : ''}`} aria-hidden />
                  {aSincronizar ? 'A sincronizar…' : 'Sincronizar agora'}
                </button>
              )}
            </div>

            {feeds.length === 0 && (
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Nenhuma plataforma ligada. As reservas que recebes no Airbnb ou no Booking
                não aparecem aqui e as datas não ficam bloqueadas.
              </p>
            )}

            {feeds.map(feed => {
              const e = estadoDoFeed(feed)
              const quando = dataLegivel(feed.last_sync)
              return (
                <div key={feed.id} className="rounded-xl border border-border bg-background px-3.5 py-3 flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: SOURCE_COLOR[feed.source] }} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{feed.nome}</p>
                        <CrachaEstado estado={e} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={feed.url}>{feed.url}</p>
                    </div>
                    <button
                      onClick={() => setConfirmarRemover(feed.id)}
                      aria-label={`Desligar ${feed.nome}`}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {ESTADO_CANAL[e].explicacao}
                  </p>

                  {feed.error && (
                    <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-red-700 leading-relaxed">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden />
                      <span>{erroAmigavel(feed.error)}</span>
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    {quando
                      ? <>Última sincronização: {quando}{feed.last_count !== undefined && ` · ${feed.last_count} datas ocupadas no calendário`}</>
                      : 'Ainda não foi sincronizado.'}
                  </p>

                  {confirmarRemover === feed.id && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col gap-2">
                      <p className="text-[12px] text-amber-900 leading-relaxed">
                        Desligar deixa de trazer reservas novas deste calendário.
                        As reservas já importadas <strong>ficam</strong> — são reservas verdadeiras e algumas podem já ter fatura ou boletim.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => remover(feed.id)}
                          disabled={aRemover === feed.id}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {aRemover === feed.id ? 'A desligar…' : 'Desligar'}
                        </button>
                        <button
                          onClick={() => setConfirmarRemover(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                        >
                          Manter ligado
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {feeds.some(f => eGestorDeCanais(f.url)) && (
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Tens um gestor de canais ligado — as reservas do Airbnb e do Booking já vêm por aí.
                Não ligues também essas plataformas diretamente ou as reservas ficam duplicadas.
              </p>
            )}

            <AssistenteLigar prop={prop} feeds={feeds} aoLigar={recarregar} />
          </>
        )}

        <PainelExportar prop={prop} />
      </div>
    </div>
  )
}

/* ── Página ───────────────────────────────────────────────────────────────── */

export default function CanaisPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [props, setProps] = useState<Property[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const lista = await fetchProperties()
      setProps(lista)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar os alojamentos.')
    } finally {
      setACarregar(false)
    }
  }, [])

  /* O primeiro carregamento encadeia-se aqui em vez de chamar `carregar`: a
   * regra `set-state-in-effect` segue a chamada até ao `setState` lá dentro e
   * não distingue o que está depois de um `await`. `carregar` continua a
   * servir os filhos, que a chamam depois de ligar ou desligar um canal. */
  useEffect(() => {
    if (!ownerId) return
    let vivo = true
    fetchProperties()
      .then(lista => { if (vivo) { setProps(lista); setErro(null) } })
      .catch(() => { if (vivo) setErro('Não foi possível carregar os alojamentos.') })
      .finally(() => { if (vivo) setACarregar(false) })
    return () => { vivo = false }
  }, [ownerId])

  /* Casas com quartos ativos não levam feeds próprios: a ocupação vive nos
   * quartos. Marca-se para o cartão o dizer, em vez de oferecer uma ligação
   * que nunca traria nada. */
  const contentores = useMemo(
    /* `ativo !== false` e não `ativo`, que é como o resto do projeto lê esta
     * coluna (`contarUnidadesReservaveis`, o feed iCal, o cron). Com `p.ativo`,
     * um quarto sem a coluna preenchida não marcava a casa como contentor e a
     * casa voltava a oferecer ligação de canais por cima dos quartos. */
    () => new Set(props.filter(p => p.parent_id && p.ativo !== false).map(p => p.parent_id)),
    [props],
  )

  /* Os quartos de cada casa, para o guia os poder nomear um a um — «repete
   * para o Quarto de Casal, o Quarto Familiar…» é acionável de uma forma que
   * «repete para cada quarto» não é. */
  const quartosPorCasa = useMemo(() => {
    const m = new Map<string, Property[]>()
    for (const p of props) {
      if (!p.parent_id || p.ativo === false) continue
      const lista = m.get(p.parent_id) ?? []
      lista.push(p)
      m.set(p.parent_id, lista)
    }
    return m
  }, [props])

  const ativos = useMemo(
    () => ordenarComQuartos(props.filter(p => p.ativo !== false)),
    [props],
  )

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-semibold tracking-tight">Canais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ligar o teu calendário ao Airbnb, ao Booking.com e a outras plataformas.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 py-5 pb-24">
        <ComoFunciona />

        {aCarregar && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            A carregar alojamentos…
          </div>
        )}

        {!aCarregar && erro && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm text-muted-foreground">{erro}</p>
            <button onClick={() => { setACarregar(true); void carregar() }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors">
              Tentar outra vez
            </button>
          </div>
        )}

        {!aCarregar && !erro && ativos.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <p className="text-lg font-semibold">Ainda não tens alojamentos</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cria o primeiro alojamento para poderes ligar o Airbnb e o Booking.com ao calendário.
              </p>
            </div>
            <Link href="/propriedades/nova"
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity">
              <Plus className="h-4 w-4" /> Criar alojamento
            </Link>
          </div>
        )}

        {!aCarregar && !erro && ativos.map(p => (
          <CartaoAlojamento
            key={p.id}
            prop={p}
            eContentor={contentores.has(p.id)}
            quartos={quartosPorCasa.get(p.id) ?? []}
            recarregar={carregar}
          />
        ))}
      </div>
    </div>
  )
}
