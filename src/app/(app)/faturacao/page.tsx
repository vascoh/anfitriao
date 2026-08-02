'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  Receipt, ShieldCheck, CircleAlert, Download, ExternalLink, Loader2, Ban, Zap,
} from 'lucide-react'
import { fmtDate, fmtMoney, today } from '@/lib/utils'

/**
 * Faturação.
 *
 * A régua desta página é uma frase: **o anfitrião nunca deve precisar de abrir
 * o programa de faturação**. Por isso não há aqui nada sobre o InvoiceXpress —
 * há uma conta que se cria em dois campos, umas credenciais da AT que se ligam
 * uma vez, e uma lista onde as faturas aparecem sozinhas depois do checkout.
 */

interface Conta {
  id: string
  conta: string
  nome_fiscal: string
  nif: string | null
  at_estado: 'por_configurar' | 'configurada' | 'falhou'
  at_erro: string | null
  serie_nome: string | null
  emissao_automatica: boolean
  pronta: boolean
}

interface LinhaReserva {
  id: string
  check_in: string
  check_out: string
  estado: string
  preco_total: number
  fatura_estado: 'nao_emitida' | 'a_emitir' | 'emitida' | 'falhou'
  fatura_numero: string | null
  fatura_url: string | null
  fatura_total: number | null
  fatura_emitida_em: string | null
  fatura_erro: string | null
  nota_credito_numero: string | null
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export default function FaturacaoPage() {
  const { user } = useUser()
  const ownerId = user?.id

  const [disponivel, setDisponivel] = useState(true)
  const [conta, setConta] = useState<Conta | null>(null)
  const [reservas, setReservas] = useState<LinhaReserva[]>([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)

  /** Lê; não escreve. Separado de `aplicar` para o efeito não escrever estado
      de forma síncrona nem depois de a página sair do ecrã. */
  const carregar = useCallback(async () => {
    const [rc, rf] = await Promise.all([
      fetch('/api/faturacao/conta').then(r => r.json()),
      fetch('/api/faturas').then(r => (r.ok ? r.json() : [])),
    ])
    return {
      disponivel: rc.disponivel !== false,
      conta: (rc.conta ?? null) as Conta | null,
      reservas: (Array.isArray(rf) ? rf : []) as LinhaReserva[],
    }
  }, [])

  const aplicar = useCallback((d: Awaited<ReturnType<typeof carregar>>) => {
    setDisponivel(d.disponivel)
    setConta(d.conta)
    setReservas(d.reservas)
    setLoading(false)
  }, [])

  const recarregar = useCallback(async () => {
    aplicar(await carregar())
  }, [carregar, aplicar])

  useEffect(() => {
    if (!ownerId) return
    let ativo = true
    carregar().then(d => { if (ativo) aplicar(d) })
    return () => { ativo = false }
  }, [ownerId, carregar, aplicar])

  const resumo = useMemo(() => {
    const emitidas = reservas.filter(r => r.fatura_estado === 'emitida')
    return {
      emitidas: emitidas.length,
      porEmitir: reservas.filter(r => r.fatura_estado === 'nao_emitida' && r.check_out <= today()).length,
      falhadas: reservas.filter(r => r.fatura_estado === 'falhou').length,
      total: emitidas.reduce((s, r) => s + (r.fatura_total ?? 0), 0),
    }
  }, [reservas])

  async function emitir(bookingId: string) {
    setOcupado(bookingId)
    try {
      const res = await fetch('/api/faturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Não foi possível emitir')
        return
      }
      toast.success(`Fatura ${json.numero ?? ''} emitida`)
      await recarregar()
    } finally {
      setOcupado(null)
    }
  }

  async function anular(bookingId: string) {
    setOcupado(bookingId)
    try {
      const res = await fetch('/api/faturas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Não foi possível anular')
        return
      }
      toast.success(`Nota de crédito ${json.numero ?? ''} emitida`)
      await recarregar()
    } finally {
      setOcupado(null)
    }
  }

  async function alternarAutomatica(valor: boolean) {
    const res = await fetch('/api/faturacao/conta', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emissaoAutomatica: valor }),
    })
    if (!res.ok) {
      toast.error('Não foi possível guardar')
      return
    }
    const json = await res.json()
    setConta(json.conta)
    toast.success(valor ? 'As faturas passam a ser emitidas sozinhas' : 'Emissão automática desligada')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Faturação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Faturas-recibo certificadas, emitidas no teu nome e comunicadas à AT.
          Incluídas na tua subscrição.
        </p>
      </header>

      {!conta && <Arranque disponivel={disponivel} onCriada={recarregar} />}

      {conta && !conta.pronta && <LigarAt conta={conta} onLigada={recarregar} />}

      {conta?.pronta && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi valor={String(resumo.emitidas)} rotulo="Faturas emitidas" />
            <Kpi valor={fmtMoney(resumo.total)} rotulo="Total faturado" />
            <Kpi
              valor={String(resumo.porEmitir)}
              rotulo="Por emitir"
              alerta={resumo.porEmitir > 0 ? 'ambar' : undefined}
            />
            <Kpi
              valor={String(resumo.falhadas)}
              rotulo="Falhadas"
              alerta={resumo.falhadas > 0 ? 'vermelho' : undefined}
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={conta.emissao_automatica}
                onChange={e => alternarAutomatica(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
                  Emitir as faturas sozinho, depois do checkout
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Todas as manhãs verificamos as reservas que terminaram e emitimos o que falta.
                  Continuas a poder emitir à mão a qualquer momento.
                </span>
              </span>
            </label>
          </section>

          <Saft />

          <Lista
            reservas={reservas}
            ocupado={ocupado}
            onEmitir={emitir}
            onAnular={anular}
          />
        </>
      )}
    </div>
  )
}

function Kpi({ valor, rotulo, alerta }: { valor: string; rotulo: string; alerta?: 'ambar' | 'vermelho' }) {
  const cor =
    alerta === 'vermelho' ? 'border-red-500/30 bg-red-500/5'
    : alerta === 'ambar' ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-border bg-card'
  const corTexto =
    alerta === 'vermelho' ? 'text-red-600 dark:text-red-400'
    : alerta === 'ambar' ? 'text-amber-600 dark:text-amber-400'
    : ''
  return (
    <div className={`rounded-2xl border p-4 ${cor}`}>
      <div className={`text-2xl font-bold tabular-nums ${corTexto}`}>{valor}</div>
      <div className="mt-1 text-xs text-muted-foreground">{rotulo}</div>
    </div>
  )
}

/** Passo 1: criar a conta. Dois campos, e nada sobre o fornecedor. */
function Arranque({ disponivel, onCriada }: { disponivel: boolean; onCriada: () => void }) {
  const [nomeFiscal, setNomeFiscal] = useState('')
  const [nif, setNif] = useState('')
  const [aCriar, setACriar] = useState(false)

  if (!disponivel) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          A faturação ainda não está disponível nesta conta. Escreve para suporte@anfitrioes.pt.
        </p>
      </section>
    )
  }

  async function criar() {
    setACriar(true)
    try {
      const res = await fetch('/api/faturacao/conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeFiscal, nif }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Não foi possível criar a conta')
        return
      }
      toast.success('Conta de faturação criada')
      onCriada()
    } finally {
      setACriar(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Receipt className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold">Ligar a faturação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Criamos a tua conta de faturação certificada e tratamos da configuração.
            As faturas saem no teu nome e no teu NIF, como a lei exige. O custo está
            incluído na subscrição.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Nome ou designação social
          </span>
          <input
            value={nomeFiscal}
            onChange={e => setNomeFiscal(e.target.value)}
            placeholder="Como aparece nas Finanças"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">NIF</span>
          <input
            value={nif}
            onChange={e => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
            inputMode="numeric"
            placeholder="123456789"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={criar}
        disabled={aCriar || !nomeFiscal.trim() || nif.length !== 9}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {aCriar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {aCriar ? 'A criar…' : 'Criar conta de faturação'}
      </button>
    </section>
  )
}

/**
 * Passo 2: credenciais da AT.
 *
 * É o único passo que o anfitrião tem mesmo de fazer, porque só ele as pode
 * criar no Portal das Finanças. Vale a pena explicá-lo com as palavras certas
 * — quem chega aqui e não percebe, desiste e nunca mais fatura.
 */
function LigarAt({ conta, onLigada }: { conta: Conta; onLigada: () => void }) {
  const [subutilizador, setSubutilizador] = useState(conta.nif ? `${conta.nif}/1` : '')
  const [senha, setSenha] = useState('')
  const [aLigar, setALigar] = useState(false)

  async function ligar() {
    setALigar(true)
    try {
      const res = await fetch('/api/faturacao/conta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subutilizador, senha }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Não foi possível ligar à AT')
        return
      }
      toast.success('Faturação pronta a emitir')
      onLigada()
    } finally {
      setALigar(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10">
          <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold">Falta um passo: autorizar a comunicação à AT</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            As faturas têm de ser comunicadas às Finanças. Para o fazermos por ti, precisamos
            de um <strong>subutilizador</strong> — uma conta secundária das Finanças, que crias
            em <em>Portal das Finanças → Todos os serviços → Gestão de Utilizadores</em>, com a
            permissão <strong>WFA — Comunicação de dados de faturas</strong>. Não é a tua senha
            de acesso ao Portal.
          </p>
        </div>
      </div>

      {conta.at_erro && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {conta.at_erro}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Subutilizador</span>
          <input
            value={subutilizador}
            onChange={e => setSubutilizador(e.target.value)}
            placeholder="123456789/1"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Senha do subutilizador</span>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="off"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A senha vai diretamente para o teu programa de faturação certificado. Não fica guardada
        no Anfitrião.
      </p>

      <button
        type="button"
        onClick={ligar}
        disabled={aLigar || !subutilizador.trim() || !senha}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {aLigar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {aLigar ? 'A ligar…' : 'Ligar à AT e criar a série'}
      </button>
    </section>
  )
}

/** O ficheiro que o contabilista pede todos os meses, num botão. */
function Saft() {
  const agora = new Date()
  // Por omissão o mês anterior: é o que se pede ao contabilista, não o corrente.
  const anterior = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1))
  const [ano, setAno] = useState(anterior.getUTCFullYear())
  const [mes, setMes] = useState(anterior.getUTCMonth() + 1)
  const [aGerar, setAGerar] = useState(false)

  async function obter() {
    setAGerar(true)
    try {
      // A geração é assíncrona do lado do fornecedor: tenta-se algumas vezes.
      for (let tentativa = 0; tentativa < 8; tentativa++) {
        const res = await fetch(`/api/faturacao/saft?ano=${ano}&mes=${mes}`)
        if (res.status === 202) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Não foi possível gerar o SAF-T')
          return
        }
        window.open(json.url, '_blank', 'noopener')
        return
      }
      toast.error('O ficheiro está a demorar. Tenta daqui a um minuto.')
    } finally {
      setAGerar(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Download className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Ficheiro para o contabilista (SAF-T)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as faturas do mês num ficheiro. É o que o contabilista pede, e é o mesmo
            que entregas às Finanças.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Mês</span>
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ano</span>
              <input
                type="number"
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="min-h-11 w-24 rounded-lg border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={obter}
              disabled={aGerar}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              {aGerar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {aGerar ? 'A gerar…' : 'Obter ficheiro'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Lista({
  reservas, ocupado, onEmitir, onAnular,
}: {
  reservas: LinhaReserva[]
  ocupado: string | null
  onEmitir: (id: string) => void
  onAnular: (id: string) => void
}) {
  if (reservas.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Ainda não há reservas para faturar. Assim que a primeira fizer checkout, a fatura
          aparece aqui.
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="border-b border-border p-5 font-bold">Reservas</h2>
      <ul className="divide-y divide-border">
        {reservas.map(r => {
          const anulada = Boolean(r.nota_credito_numero)
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {fmtDate(r.check_in)} – {fmtDate(r.check_out)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtMoney(r.preco_total)}
                  </span>
                  <Estado estado={anulada ? 'anulada' : r.fatura_estado} />
                </div>

                {r.fatura_numero && (
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {r.fatura_numero}
                    {r.fatura_emitida_em && ` · ${fmtDate(r.fatura_emitida_em.slice(0, 10))}`}
                    {anulada && ` · anulada por ${r.nota_credito_numero}`}
                  </p>
                )}

                {r.fatura_erro && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{r.fatura_erro}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {r.fatura_url && (
                  <a
                    href={r.fatura_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Ver
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}

                {r.fatura_estado === 'emitida' && !anulada && (
                  <button
                    type="button"
                    onClick={() => onAnular(r.id)}
                    disabled={ocupado === r.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Ban className="h-3 w-3" aria-hidden="true" />
                    Anular
                  </button>
                )}

                {(r.fatura_estado === 'nao_emitida' || r.fatura_estado === 'falhou') && (
                  <button
                    type="button"
                    onClick={() => onEmitir(r.id)}
                    disabled={ocupado === r.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {ocupado === r.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                    {r.fatura_estado === 'falhou' ? 'Tentar outra vez' : 'Emitir'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Estado({ estado }: { estado: LinhaReserva['fatura_estado'] | 'anulada' }) {
  const mapa = {
    emitida: { texto: 'Emitida', classe: 'text-emerald-600 dark:text-emerald-400', Icon: ShieldCheck },
    anulada: { texto: 'Anulada', classe: 'text-muted-foreground', Icon: Ban },
    falhou: { texto: 'Falhou', classe: 'text-red-600 dark:text-red-400', Icon: CircleAlert },
    a_emitir: { texto: 'A emitir', classe: 'text-muted-foreground', Icon: Loader2 },
    nao_emitida: { texto: 'Por emitir', classe: 'text-amber-600 dark:text-amber-400', Icon: Receipt },
  } as const

  const { texto, classe, Icon } = mapa[estado]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${classe}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {texto}
    </span>
  )
}
