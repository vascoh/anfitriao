'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, Clipboard, ExternalLink, EyeOff, Globe2,
  Info, Loader2, Mail, RefreshCw, ShieldCheck, ShoppingBag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { APP_URL } from '@/lib/config'
import { dominioRaiz, normalizarDominio, problemaDominio, type DominioProprio, type EnderecoDoSite } from '@/lib/dominios'
import type { DiagnosticoDns, RegistoVerificado } from '@/lib/dns-diagnostico'

type Resposta = {
  dominio: DominioProprio | null
  integracaoConfigurada: boolean
  diagnostico?: DiagnosticoDns | null
  mapa?: { slug: string | null; enderecos: EnderecoDoSite[] }
  error?: string
}

/** Enquanto o DNS propaga, verificamos sozinhos — sem martelar a API. */
const INTERVALO_MS = 30_000
const MAX_AUTOMATICAS = 20

async function lerResposta(res: Response): Promise<Resposta> {
  const data = await res.json().catch(() => ({})) as Resposta
  if (!res.ok) throw new Error(data.error || 'Ocorreu um erro. Tenta novamente.')
  return data
}

async function escrever(init: RequestInit): Promise<Resposta> {
  return lerResposta(await fetch('/api/dominio', init))
}

function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null)
  const copiar = useCallback(async (chave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(chave)
      setTimeout(() => setCopiado(c => (c === chave ? null : c)), 1500)
    } catch {
      toast.error('Não foi possível copiar. Seleciona o texto e copia à mão.')
    }
  }, [])
  return { copiado, copiar }
}

export default function DominioPage() {
  const [dados, setDados] = useState<Resposta | null>(null)
  const [valor, setValor] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [ultimaVerificacao, setUltimaVerificacao] = useState<number | null>(null)
  const [automaticas, setAutomaticas] = useState(0)
  // Para avisar só na passagem a ativo, não em cada verificação.
  const estadoAnterior = useRef<DominioProprio['estado'] | undefined>(undefined)
  useEffect(() => { estadoAnterior.current = dados?.dominio?.estado }, [dados?.dominio?.estado])

  useEffect(() => {
    let ativo = true
    fetch('/api/dominio', { cache: 'no-store' })
      .then(lerResposta)
      .then(novo => { if (ativo) { setDados(novo); setUltimaVerificacao(Date.now()) } })
      .catch(erro => { if (ativo) toast.error(erro instanceof Error ? erro.message : 'Não foi possível carregar o domínio.') })
    return () => { ativo = false }
  }, [])

  const verificar = useCallback(async (silencioso = false) => {
    if (!silencioso) setATrabalhar(true)
    try {
      const anterior = estadoAnterior.current
      const novo = await escrever({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'verificar' }),
      })
      setDados(novo)
      setUltimaVerificacao(Date.now())
      if (novo.dominio?.estado === 'ativo' && anterior !== 'ativo') toast.success('Domínio ativo e protegido por SSL.')
      else if (!silencioso && novo.dominio?.estado !== 'ativo') toast.info('Ainda não está tudo certo. Vê o estado de cada registo abaixo.')
    } catch (erro) {
      if (!silencioso) toast.error(erro instanceof Error ? erro.message : 'Não foi possível verificar.')
    } finally {
      if (!silencioso) setATrabalhar(false)
    }
  }, [])

  const pendente = !!dados?.dominio && dados.dominio.estado !== 'ativo'
  useEffect(() => {
    if (!pendente) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || automaticas >= MAX_AUTOMATICAS) return
      setAutomaticas(n => n + 1)
      void verificar(true)
    }, INTERVALO_MS)
    return () => clearInterval(id)
  }, [pendente, verificar, automaticas])

  async function ligar() {
    const dominio = normalizarDominio(valor)
    const problema = problemaDominio(dominio)
    if (problema) return toast.error(problema)
    setATrabalhar(true)
    try {
      const novo = await escrever({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominio: valor }),
      })
      setDados(novo)
      setUltimaVerificacao(Date.now())
      setAutomaticas(0)
      toast.success('Domínio adicionado. Agora cria os registos no teu fornecedor.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível ligar o domínio.')
    } finally { setATrabalhar(false) }
  }

  async function remover() {
    if (!confirm('Remover este domínio do site? O domínio continua a ser teu, mas deixa de abrir o site.')) return
    setATrabalhar(true)
    try {
      await escrever({ method: 'DELETE' })
      setDados(prev => ({ dominio: null, integracaoConfigurada: prev?.integracaoConfigurada ?? false, mapa: prev?.mapa }))
      setValor('')
      toast.success('Domínio removido do site.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível remover.')
    } finally { setATrabalhar(false) }
  }

  const dominio = dados?.dominio

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-28 flex flex-col gap-6">
      <div>
        <Link href="/website" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Site de reservas
        </Link>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Globe2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Domínio próprio</h1>
            <p className="text-sm text-muted-foreground mt-1">O teu site num endereço independente, como casadomar.pt.</p>
          </div>
        </div>
      </div>

      {!dados ? (
        <div className="rounded-xl border border-border bg-card p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : dominio ? (
        <>
          <Progresso dominio={dominio} diagnostico={dados.diagnostico ?? null} />
          {dominio.estado === 'ativo'
            ? <Ativo dominio={dominio} />
            : <Ligacao dominio={dominio} diagnostico={dados.diagnostico ?? null} />}

          <div className="flex flex-wrap items-center gap-2">
            {dominio.estado === 'ativo' && (
              <a href={`https://${dominio.dominio}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium">
                <ExternalLink className="h-4 w-4" /> Abrir site
              </a>
            )}
            <button onClick={() => void verificar()} disabled={aTrabalhar} className="inline-flex items-center gap-2 rounded-lg border border-input px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${aTrabalhar ? 'animate-spin' : ''}`} /> Verificar agora
            </button>
            {pendente && ultimaVerificacao && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {automaticas < MAX_AUTOMATICAS ? 'Verificamos sozinhos a cada 30 segundos' : 'Verificação automática em pausa'} · <UltimaVez quando={ultimaVerificacao} />
              </span>
            )}
            <button onClick={remover} disabled={aTrabalhar} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50 sm:ml-auto">
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          </div>
        </>
      ) : (
        <NovoDominio
          valor={valor}
          setValor={setValor}
          ligar={ligar}
          aTrabalhar={aTrabalhar}
          integracaoConfigurada={dados.integracaoConfigurada}
        />
      )}

      {dados?.mapa && dados.mapa.enderecos.length > 0 && (
        <MapaDeEnderecos
          enderecos={dados.mapa.enderecos}
          slug={dados.mapa.slug}
          dominio={dominio?.dominio ?? (normalizarDominio(valor) && !problemaDominio(normalizarDominio(valor)) ? normalizarDominio(valor)!.replace(/^www\./, '') : null)}
          ativo={dominio?.estado === 'ativo'}
        />
      )}
    </div>
  )
}

function UltimaVez({ quando }: { quando: number }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.round((agora - quando) / 1000))
  return <>última há {s < 10 ? 'instantes' : s < 60 ? `${s} s` : `${Math.round(s / 60)} min`}</>
}

/* ── Sem domínio ─────────────────────────────────────────────────────────── */

function NovoDominio({ valor, setValor, ligar, aTrabalhar, integracaoConfigurada }: {
  valor: string
  setValor: (v: string) => void
  ligar: () => void
  aTrabalhar: boolean
  integracaoConfigurada: boolean
}) {
  const normalizado = normalizarDominio(valor)
  const problema = valor.trim() ? problemaDominio(normalizado) : null
  // Mostra o que vai acontecer antes de carregar no botão.
  const alvo = normalizado && !problema ? normalizado.replace(/^www\./, '') : null
  const raiz = alvo ? dominioRaiz(alvo) === alvo : false

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Já tens um domínio?</h2>
          <p className="text-sm text-muted-foreground mt-1">Pode ter sido comprado em qualquer fornecedor. Não é transferido nem fica preso ao Anfitrião, e o email que já usas nesse domínio continua a funcionar.</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); ligar() }} className="flex flex-col gap-2">
          <label htmlFor="dominio" className="text-xs font-medium text-muted-foreground">Domínio</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="dominio" value={valor} onChange={e => setValor(e.target.value)} placeholder="casadomar.pt"
              autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" aria-invalid={!!problema} aria-describedby="dominio-ajuda"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-red-400"
            />
            <button type="submit" disabled={aTrabalhar || !integracaoConfigurada || !alvo} className="inline-flex justify-center items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {aTrabalhar && <Loader2 className="h-4 w-4 animate-spin" />} Ligar domínio
            </button>
          </div>
          <p id="dominio-ajuda" className={`text-xs ${problema ? 'text-red-600' : 'text-muted-foreground'}`}>
            {problema ?? (alvo
              ? raiz
                ? <>Vamos ligar <strong className="font-mono">{alvo}</strong> e <strong className="font-mono">www.{alvo}</strong> (que reencaminha para o primeiro).</>
                : <>Vamos ligar o subdomínio <strong className="font-mono">{alvo}</strong>. O resto de <span className="font-mono">{dominioRaiz(alvo)}</span> fica como está.</>
              : 'Podes colar o endereço completo; nós limpamos o https:// e as barras.')}
          </p>
        </form>
        {!integracaoConfigurada && <p className="text-xs text-amber-700">A ativação automática está a ser preparada pelo administrador da plataforma.</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0"><ShoppingBag className="h-5 w-5" /></div>
        <div className="flex-1"><h2 className="font-semibold">Ainda não tens domínio?</h2><p className="text-sm text-muted-foreground mt-1">Nós tratamos da pesquisa, compra e configuração. O domínio fica registado em teu nome.</p></div>
        <a href="mailto:suporte@anfitrioes.pt?subject=Quero%20comprar%20um%20dom%C3%ADnio" className="rounded-lg border border-input px-3.5 py-2 text-sm font-medium text-center hover:bg-muted">Pedir proposta</a>
      </section>

      <ol className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
        <li><strong className="block text-foreground mb-1">1. Liga</strong>Indica o domínio comprado onde quiseres.</li>
        <li><strong className="block text-foreground mb-1">2. Configura</strong>Cria os registos DNS que te mostramos, um a um.</li>
        <li><strong className="block text-foreground mb-1">3. Publica</strong>Verificamos sozinhos; o SSL é automático.</li>
      </ol>
    </>
  )
}

/* ── Progresso ───────────────────────────────────────────────────────────── */

function Progresso({ dominio, diagnostico }: { dominio: DominioProprio; diagnostico: DiagnosticoDns | null }) {
  const registos = diagnostico?.registos ?? []
  const certos = registos.filter(r => r.estado === 'certo').length
  const ativo = dominio.estado === 'ativo'
  const dnsOk = ativo || dominio.configurado || (registos.length > 0 && certos === registos.length)
  const passos = [
    { titulo: 'Domínio adicionado', detalhe: dominio.dominio, feito: true },
    { titulo: 'Registos DNS', detalhe: registos.length ? `${ativo ? registos.length : certos} de ${registos.length} certos` : dnsOk ? 'Certos' : 'Por criar', feito: dnsOk },
    { titulo: 'Posse confirmada', detalhe: dominio.verificado ? 'Confirmada' : 'A aguardar', feito: dominio.verificado },
    { titulo: 'Online com SSL', detalhe: ativo ? 'Ativo' : 'Automático no fim', feito: ativo },
  ]
  const atual = passos.findIndex(p => !p.feito)

  return (
    <ol className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Progresso da ligação">
      {passos.map((p, i) => (
        <li key={p.titulo} className="flex items-start gap-2.5" aria-current={i === atual ? 'step' : undefined}>
          <span className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${p.feito ? 'bg-emerald-500 text-white' : i === atual ? 'bg-amber-500/15 text-amber-700 ring-2 ring-amber-500/40' : 'bg-muted text-muted-foreground'}`}>
            {p.feito ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-medium ${p.feito || i === atual ? '' : 'text-muted-foreground'}`}>{p.titulo}</span>
            <span className="block text-xs text-muted-foreground truncate">{p.detalhe}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ── Ativo ───────────────────────────────────────────────────────────────── */

function Ativo({ dominio }: { dominio: DominioProprio }) {
  return (
    <section className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex gap-3">
      <ShieldCheck className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{dominio.dominio} está online, com certificado SSL</p>
        <p className="text-xs mt-0.5 opacity-80">Podes pô-lo nos cartões, no Instagram e na resposta automática do email. O endereço antigo continua a funcionar.</p>
      </div>
    </section>
  )
}

/* ── A ligar: registos, um a um ──────────────────────────────────────────── */

const ROTULO_ESTADO: Record<RegistoVerificado['estado'], { texto: string; classe: string; Icone: typeof Check }> = {
  certo: { texto: 'Certo', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', Icone: Check },
  'em-falta': { texto: 'Por criar', classe: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', Icone: CircleDashed },
  diferente: { texto: 'Valor diferente', classe: 'bg-red-500/10 text-red-700 dark:text-red-300', Icone: X },
}

function Ligacao({ dominio, diagnostico }: { dominio: DominioProprio; diagnostico: DiagnosticoDns | null }) {
  const { copiado, copiar } = useCopiar()
  // Sem diagnóstico (falha da consulta), mostramos os registos pedidos sem estado.
  const registos: Array<RegistoVerificado | (DominioProprio['dns'][number] & { nomeCurto?: string; estado?: undefined; encontrado?: string[] })> =
    diagnostico?.registos ?? dominio.dns
  const fornecedor = diagnostico?.fornecedor

  return (
    <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Cria estes registos no teu fornecedor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {fornecedor
            ? <>O DNS de <span className="font-mono">{diagnostico?.raiz}</span> é gerido pela <strong className="text-foreground">{fornecedor.nome}</strong>. Entra na conta, abre a zona DNS do domínio e acrescenta:</>
            : <>Entra na conta onde compraste o domínio, abre a gestão de DNS (às vezes chama-se «Zona DNS» ou «Registos») e acrescenta:</>}
        </p>
      </div>

      {fornecedor?.dica && (
        <p className="rounded-lg bg-sky-500/8 border border-sky-500/20 p-3 text-xs text-sky-900 dark:text-sky-200 flex gap-2">
          <Info className="h-4 w-4 shrink-0" /> <span><strong>{fornecedor.nome}:</strong> {fornecedor.dica}</span>
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {registos.map((r, i) => {
          const nome = r.nomeCurto ?? r.nome
          const estado = r.estado ? ROTULO_ESTADO[r.estado] : null
          return (
            <li key={`${r.tipo}-${r.nome}-${i}`} className={`rounded-lg border p-3 flex flex-col gap-2 ${r.estado === 'certo' ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-border'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{r.motivo ?? 'Registo necessário'}</p>
                {estado && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${estado.classe}`}>
                    <estado.Icone className="h-3 w-3" /> {estado.texto}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[4.5rem_10rem_1fr] gap-x-3 gap-y-1.5 text-sm items-center">
                <dt className="sr-only">Tipo</dt>
                <dd className="font-mono text-xs font-semibold rounded bg-muted px-2 py-1 text-center self-start">{r.tipo}</dd>
                <dt className="sr-only">Nome</dt>
                <dd><Copiavel rotulo="Nome" texto={nome} copiado={copiado === `n${i}`} onCopiar={() => copiar(`n${i}`, nome)} /></dd>
                <dt className="sr-only">Valor</dt>
                <dd className="col-span-2 sm:col-span-1"><Copiavel rotulo="Valor" texto={r.valor} copiado={copiado === `v${i}`} onCopiar={() => copiar(`v${i}`, r.valor)} /></dd>
              </dl>
              {r.estado === 'diferente' && r.encontrado && r.encontrado.length > 0 && (
                <p className="text-xs text-red-700 dark:text-red-300">Hoje responde: <span className="font-mono break-all">{r.encontrado.join(', ')}</span></p>
              )}
            </li>
          )
        })}
      </ul>

      {diagnostico && diagnostico.conflitos.length > 0 && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.04] p-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Apaga estes registos antigos</p>
          <ul className="flex flex-col gap-1.5">
            {diagnostico.conflitos.map((c, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono font-semibold">{c.tipo} {c.nome} → {c.valor}</span>
                <span className="block text-muted-foreground">{c.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
        <p className="flex gap-2"><Mail className="h-4 w-4 shrink-0" /> Não mexas nos nameservers nem nos registos MX: o email do domínio continua a funcionar.</p>
        <p className="flex gap-2"><Info className="h-4 w-4 shrink-0" /> Se o painel acrescentar o domínio ao nome sozinho, escreve só o que aparece em «Nome» (ex.: <span className="font-mono">www</span>). A propagação demora minutos, às vezes até 48 h.</p>
      </div>

      {diagnostico?.indisponivel && <p className="text-xs text-amber-700">Não conseguimos consultar o DNS agora; os registos acima continuam a ser os necessários.</p>}
      {dominio.ultimo_erro && <p className="text-xs text-red-600">{dominio.ultimo_erro}</p>}
    </section>
  )
}

function Copiavel({ rotulo, texto, copiado, onCopiar }: { rotulo: string; texto: string; copiado: boolean; onCopiar: () => void }) {
  return (
    <button
      type="button" onClick={onCopiar} aria-label={`Copiar ${rotulo.toLowerCase()}: ${texto}`}
      className="w-full group flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-left hover:border-primary/50 hover:bg-muted/40"
    >
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</span>
        <span className="block font-mono text-xs break-all">{texto}</span>
      </span>
      {copiado
        ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        : <Clipboard className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />}
    </button>
  )
}

/* ── Mapa de endereços ───────────────────────────────────────────────────── */

const GRUPOS: Array<{ id: EnderecoDoSite['grupo']; titulo: string }> = [
  { id: 'pagina', titulo: 'Páginas' },
  { id: 'alojamento', titulo: 'Alojamentos' },
  { id: 'legal', titulo: 'Legal e motores de busca' },
]

function MapaDeEnderecos({ enderecos, slug, dominio, ativo }: { enderecos: EnderecoDoSite[]; slug: string | null; dominio: string | null; ativo: boolean }) {
  const atual = slug ? `${APP_URL.replace(/\/$/, '')}/r/${slug}` : null
  const base = dominio ?? 'o-teu-dominio.pt'
  const porGrupo = useMemo(() => GRUPOS.map(g => ({ ...g, itens: enderecos.filter(e => e.grupo === g.id) })).filter(g => g.itens.length), [enderecos])

  return (
    <section className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">Mapa de endereços</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O que abre em cada endereço de <span className="font-mono">{base}</span>.
            {ativo ? ' Já está a funcionar.' : ' Fica assim quando o domínio estiver ativo.'}
          </p>
        </div>
        <Link href="/website/editor" className="text-xs font-medium text-primary inline-flex items-center gap-1 shrink-0">Editar páginas <ArrowRight className="h-3 w-3" /></Link>
      </div>

      {porGrupo.map(g => (
        <div key={g.id} className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {g.itens.map(e => {
              const href = ativo && dominio ? `https://${dominio}${e.caminho === '/' ? '' : e.caminho}` : atual ? `${atual}${e.caminho === '/' ? '' : e.caminho === '/sitemap.xml' ? '/sitemap' : e.caminho}` : null
              return (
                <li key={e.caminho} className={`flex items-center gap-3 px-3 py-2 text-sm ${e.visivel ? '' : 'opacity-60'}`}>
                  <span className="font-mono text-xs min-w-0 flex-1 truncate" title={`${base}${e.caminho}`}>
                    <span className="text-muted-foreground hidden sm:inline">{base}</span>{e.caminho}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0 truncate flex items-center gap-1.5">
                    {e.titulo}
                    {!e.visivel && <span className="inline-flex items-center gap-1 text-[10px] rounded bg-muted px-1.5 py-0.5"><EyeOff className="h-3 w-3" /> escondida</span>}
                  </span>
                  {href && e.visivel && (
                    <a href={href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0" aria-label={`Abrir ${e.titulo}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <ul className="text-xs text-muted-foreground flex flex-col gap-1">
        {dominio && dominioRaiz(dominio) === dominio && <li><span className="font-mono">www.{dominio}</span> reencaminha para <span className="font-mono">{dominio}</span>, com o mesmo caminho.</li>}
        {atual && <li>O endereço atual, <span className="font-mono break-all">{atual}</span>, continua a abrir o mesmo site.</li>}
      </ul>
    </section>
  )
}
