'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Sparkles, Send, Mail, MessageCircle, ClipboardPaste, AlertTriangle, ExternalLink, Loader2, X, BookText,
} from 'lucide-react'
import { fmtDate, today } from '@/lib/utils'
import { fetchBookings, fetchGuests, fetchProperties } from '@/lib/fetcher'
import { guardar } from '@/lib/guardar'
import { CANAIS, CANAL_LABEL, ORIGEM_LABEL, linkWhatsApp, type CanalMensagem, type Mensagem } from '@/lib/mensagens'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import { quando, selecaoParaQuery, type ConversaAberta, type Selecao } from './tipos'
import { IA_ATIVA } from '@/lib/ia'
import { RespostasGuardadas } from './respostas-guardadas'

const MARCA_CONFIRMAR = /\[confirmar[^\]]*\]/i

/** PATCH a `/api/mensagens`, com a mensagem do servidor quando recusa. */
async function guardarComMetodo(metodo: 'PATCH', corpo: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/mensagens', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    if (res.ok) return true
    toast.error((await res.json().catch(() => null))?.error ?? 'Não foi possível guardar.')
  } catch {
    toast.error('Sem ligação. Verifica a internet e tenta outra vez.')
  }
  return false
}

function Bolha({ m }: { m: Mensagem }) {
  const minha = m.direcao === 'saida'
  const estado =
    m.estado === 'falhou' ? `Não enviada${m.erro ? `: ${m.erro}` : ''}` :
    m.estado === 'registada' && minha && m.canal === 'whatsapp' ? 'Aberta no WhatsApp' :
    m.estado === 'registada' ? 'Registada à mão' :
    m.estado === 'enviada' ? 'Enviada' : null
  return (
    <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
        minha
          ? m.estado === 'falhou' ? 'bg-destructive/10 border border-destructive/30' : 'bg-primary text-primary-foreground'
          : 'bg-muted'
      }`}>
        {m.assunto && m.canal === 'email' && (!minha || m.origem) && <p className="text-xs font-semibold mb-1 opacity-80">{m.assunto}</p>}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.corpo}</p>
        <p className={`mt-1.5 text-[11px] flex flex-wrap items-center gap-x-1.5 ${minha && m.estado !== 'falhou' ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
          <span>{CANAL_LABEL[m.canal]}</span>
          <span aria-hidden>·</span>
          <time dateTime={m.criado_em}>{quando(m.criado_em)}</time>
          {estado && <><span aria-hidden>·</span><span className={m.estado === 'falhou' ? 'text-destructive font-medium' : ''}>{estado}</span></>}
          {m.origem && <><span aria-hidden>·</span><span>{ORIGEM_LABEL[m.origem]}</span></>}
          {m.sugerida_por_ia && <><span aria-hidden>·</span><span className="inline-flex items-center gap-0.5"><Sparkles className="h-3 w-3" aria-hidden />IA</span></>}
        </p>
      </div>
    </div>
  )
}

function RegistarMensagem({ selecao, canalInicial, aoFechar, aoRegistar }: {
  selecao: Selecao
  canalInicial: CanalMensagem
  aoFechar: () => void
  aoRegistar: (direcao: 'entrada' | 'saida') => void
}) {
  const [canal, setCanal] = useState<CanalMensagem>(canalInicial)
  const [direcao, setDirecao] = useState<'entrada' | 'saida'>('entrada')
  const [corpo, setCorpo] = useState('')
  const [aGravar, setAGravar] = useState(false)

  async function gravar() {
    if (!corpo.trim()) return
    setAGravar(true)
    const ok = await guardar('/api/mensagens', {
      ...('reserva' in selecao ? { reserva_id: selecao.reserva } : { contacto: selecao.contacto }),
      canal, direcao, corpo,
      // O que se enviou noutro sítio regista-se — não se volta a enviar.
      registo: true,
    })
    setAGravar(false)
    if (!ok) return
    aoRegistar(direcao)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Registar mensagem">
      <div className="absolute inset-0 bg-black/40" onClick={aoFechar} aria-hidden />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Registar mensagem</h2>
          <button onClick={aoFechar} aria-label="Fechar" className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Para o que chegou ou saiu por outro lado — Airbnb, Booking.com, SMS, telefone. Fica no histórico
          da reserva e a IA passa a contar com ela.
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quem escreveu">
          {(['entrada', 'saida'] as const).map(d => (
            <button key={d} role="radio" aria-checked={direcao === d} onClick={() => setDirecao(d)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${direcao === d ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
              {d === 'entrada' ? 'Do hóspede' : 'Enviada por mim'}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Por onde</span>
          <select value={canal} onChange={e => setCanal(e.target.value as CanalMensagem)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {CANAIS.map(c => <option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mensagem</span>
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={6} autoFocus
            placeholder="Cola aqui a mensagem"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y" />
        </label>
        <button onClick={gravar} disabled={!corpo.trim() || aGravar}
          className="rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40">
          {aGravar ? 'A registar…' : 'Registar'}
        </button>
      </div>
    </div>
  )
}

/** Lista de reservas para escolher a que pertence uma conversa sem reserva. */
export function EscolherReserva({ aoFechar, aoEscolher, titulo = 'Associar a uma reserva' }: {
  aoFechar: () => void
  aoEscolher: (reservaId: string) => void
  titulo?: string
}) {
  const [linhas, setLinhas] = useState<{ id: string; texto: string; data: string }[] | null>(null)
  const [erro, setErro] = useState(false)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    const exigirSucesso = { exigirSucesso: true }
    const hoje = today()
    Promise.all([fetchBookings(undefined, exigirSucesso), fetchGuests(exigirSucesso), fetchProperties(exigirSucesso)])
      .then(([bs, gs, ps]) => {
        const nomeG = new Map(gs.map(g => [g.id, g.nome]))
        const nomeP = new Map(ps.map(p => [p.id, p.nome]))
        const ativas = bs.filter(b => b.estado !== 'cancelada')
        // Primeiro as que estão a decorrer ou aí vêm, depois as passadas.
        const ordenadas = [
          ...ativas.filter(b => b.check_out >= hoje).sort((a, b) => a.check_in.localeCompare(b.check_in)),
          ...ativas.filter(b => b.check_out < hoje).sort((a, b) => b.check_in.localeCompare(a.check_in)),
        ]
        setLinhas(ordenadas.slice(0, 300).map(b => ({
          id: b.id,
          texto: `${(b.hospede_id && nomeG.get(b.hospede_id)) || 'Sem hóspede'} · ${nomeP.get(b.propriedade_id) ?? ''}`,
          data: `${fmtDate(b.check_in)} – ${fmtDate(b.check_out)}`,
        })))
      })
      .catch(() => setErro(true))
  }, [])

  const visiveis = (linhas ?? []).filter(l => !filtro.trim() || l.texto.toLowerCase().includes(filtro.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/40" onClick={aoFechar} aria-hidden />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 max-h-[85vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button onClick={aoFechar} aria-label="Fechar" className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Procurar hóspede ou alojamento" aria-label="Procurar reserva"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm" autoFocus />
        <div className="overflow-y-auto -mx-1 min-h-24">
          {erro ? <p className="text-sm text-destructive px-1">Não foi possível carregar as reservas.</p>
            : !linhas ? <Loader2 className="h-4 w-4 animate-spin m-4" aria-label="A carregar" />
            : visiveis.length === 0 ? <p className="text-sm text-muted-foreground px-1">Sem reservas.</p>
            : visiveis.map(l => (
              <button key={l.id} onClick={() => aoEscolher(l.id)}
                className="w-full text-left rounded-lg px-2 py-2 hover:bg-muted flex items-center justify-between gap-3">
                <span className="text-sm truncate">{l.texto}</span>
                <span className="text-xs text-muted-foreground shrink-0">{l.data}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

export function ConversaView({ selecao, aoVoltar, aoMudar }: {
  selecao: Selecao
  aoVoltar: () => void
  /** A lista tem de saber que algo mudou (lida, enviada, associada). */
  aoMudar: () => void
}) {
  const [dados, setDados] = useState<ConversaAberta | null>(null)
  const [erro, setErro] = useState(false)
  const [canal, setCanal] = useState<'email' | 'whatsapp'>('email')
  const [texto, setTexto] = useState('')
  const [assunto, setAssunto] = useState('')
  const [deIa, setDeIa] = useState(false)
  const [confirmar, setConfirmar] = useState<string[]>([])
  const [instrucao, setInstrucao] = useState('')
  const [mostrarInstrucao, setMostrarInstrucao] = useState(false)
  const [aSugerir, setASugerir] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [registar, setRegistar] = useState(false)
  const [respostas, setRespostas] = useState(false)
  const [aAssociar, setAAssociar] = useState(false)
  const [linkFalha, setLinkFalha] = useState<string | null>(null)
  const fundo = useRef<HTMLDivElement>(null)
  const chave = selecaoParaQuery(selecao)

  const carregar = useCallback(async (marcarLida: boolean) => {
    try {
      const res = await fetch(`/api/mensagens?${chave}`)
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json() as ConversaAberta
      setDados(d)
      setErro(false)
      if (marcarLida && d.mensagens.some(m => m.direcao === 'entrada' && !m.lida_em)) {
        const lida = await fetch('/api/mensagens', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'lida',
            ...('reserva' in selecao ? { reserva_id: selecao.reserva } : { canal: selecao.canal, contacto: selecao.contacto }),
          }),
        })
        // Se não marcou, a conversa continua «por ler» — o que é verdade.
        if (lida.ok) aoMudar()
      }
      return d
    } catch {
      setErro(true)
      return null
    }
  }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps -- `selecao` muda com `chave`

  // Ao abrir: carregar, marcar como lida e escolher o canal da última mensagem do
  // hóspede. Cada conversa é uma montagem nova (`key` na página): não há estado a limpar.
  useEffect(() => {
    let vivo = true
    const t0 = setTimeout(() => { carregar(true).then(d => {
      if (!vivo || !d) return
      const ultimaDele = [...d.mensagens].reverse().find(m => m.direcao === 'entrada')
      const preferido = ultimaDele?.canal === 'whatsapp' || (!d.capacidades.email && d.capacidades.whatsappLink) ? 'whatsapp' : 'email'
      setCanal(preferido)
    }) }, 0)
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(true) }, 20_000)
    return () => { vivo = false; clearTimeout(t0); clearInterval(t) }
  }, [carregar])

  useEffect(() => { fundo.current?.scrollIntoView({ block: 'end' }) }, [dados?.mensagens.length])

  async function sugerir() {
    setASugerir(true)
    try {
      const res = await fetch('/api/mensagens/sugerir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...('reserva' in selecao ? { reserva_id: selecao.reserva } : { canal: selecao.canal, contacto: selecao.contacto }),
          instrucao: instrucao.trim() || undefined,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error ?? 'Não foi possível sugerir uma resposta.'); return }
      setTexto(d.resposta)
      setDeIa(true)
      setConfirmar(Array.isArray(d.precisa_confirmar) ? d.precisa_confirmar : [])
      setMostrarInstrucao(false)
    } catch {
      toast.error('Falha de rede ao pedir a sugestão.')
    } finally {
      setASugerir(false)
    }
  }

  async function enviar() {
    if (!dados || !texto.trim()) return
    if (MARCA_CONFIRMAR.test(texto)) {
      toast.error('Ainda há partes marcadas com [confirmar] — completa-as antes de enviar.')
      return
    }
    setLinkFalha(null)
    const alvo = 'reserva' in selecao ? { reserva_id: selecao.reserva } : { contacto: selecao.contacto }

    // Sem API do WhatsApp (ou fora das 24 h): abre-se já o WhatsApp, no mesmo
    // gesto do clique — depois de um `await`, o browser bloqueia a janela.
    const viaLink = canal === 'whatsapp' && !(dados.capacidades.whatsappApi && dados.capacidades.whatsappJanela)
    if (viaLink) {
      const link = dados.contactos.telefone ? linkWhatsApp(dados.contactos.telefone, texto.trim()) : null
      if (!link) { toast.error('O hóspede não tem um telefone válido.'); return }
      window.open(link, '_blank', 'noopener')
    }

    setAEnviar(true)
    try {
      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...alvo, canal, direcao: 'saida', corpo: texto.trim(),
          assunto: canal === 'email' ? assunto.trim() || undefined : undefined,
          sugerida_por_ia: deIa,
          modo: viaLink ? 'link' : 'auto',
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(d?.error ?? 'Não foi possível enviar.')
        if (d?.link) setLinkFalha(d.link)
        if (d?.mensagem) await carregar(false)
        return
      }
      toast.success(viaLink ? 'Aberta no WhatsApp e guardada no histórico' : 'Mensagem enviada')
      setTexto(''); setAssunto(''); setDeIa(false); setConfirmar([]); setInstrucao('')
      await carregar(false)
      aoMudar()
    } catch {
      toast.error('Falha de rede. A mensagem pode não ter sido enviada.')
    } finally {
      setAEnviar(false)
    }
  }

  async function associar(reservaId: string) {
    if ('reserva' in selecao) return
    const ok = await guardarComMetodo('PATCH', { acao: 'associar', reserva_id: reservaId, canal: selecao.canal, contacto: selecao.contacto })
    if (!ok) return
    toast.success('Conversa associada à reserva')
    setAAssociar(false)
    aoMudar()
    aoVoltar()
  }

  if (erro && !dados) {
    return <ErroAoCarregar oQue="a conversa" aoTentar={() => { setErro(false); carregar(true) }} />
  }
  if (!dados) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="A carregar" />
      </div>
    )
  }

  const caps = dados.capacidades
  const nome = dados.hospede?.nome ?? ('contacto' in selecao ? selecao.contacto : 'Hóspede')
  const podeEmail = caps.email
  const podeWhatsApp = caps.whatsappLink || caps.whatsappApi
  const whatsappDireto = caps.whatsappApi && caps.whatsappJanela
  const temConfirmar = MARCA_CONFIRMAR.test(texto)

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <button onClick={aoVoltar} className="md:hidden p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Voltar às conversas">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{nome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {dados.reserva
              ? `${dados.propriedade ?? 'Reserva'} · ${fmtDate(dados.reserva.check_in)} – ${fmtDate(dados.reserva.check_out)}`
              : 'Sem reserva associada'}
          </p>
        </div>
        {dados.reserva ? (
          <Link href={`/reservas/${dados.reserva.id}`} className="text-xs font-semibold text-primary hover:underline shrink-0">Ver reserva</Link>
        ) : (
          <button onClick={() => setAAssociar(true)} className="text-xs font-semibold text-primary hover:underline shrink-0">Associar a reserva</button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2.5" aria-live="polite">
        {dados.mensagens.length === 0 && (
          <div className="m-auto text-center max-w-xs text-sm text-muted-foreground flex flex-col gap-2 py-10">
            <p className="font-medium text-foreground">Ainda sem mensagens</p>
            <p>{IA_ATIVA
              ? 'Escreve a primeira, pede uma sugestão à IA, ou regista o que o hóspede te mandou noutro sítio.'
              : 'Escreve a primeira, usa uma resposta guardada, ou regista o que o hóspede te mandou noutro sítio.'}</p>
          </div>
        )}
        {dados.mensagens.map(m => <Bolha key={m.id} m={m} />)}
        <div ref={fundo} />
      </div>

      <div className="border-t border-border bg-background px-3 py-3 flex flex-col gap-2">
        {linkFalha && (
          <a href={linkFalha} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            <ExternalLink className="h-4 w-4" /> Abrir no WhatsApp em vez disso
          </a>
        )}

        {respostas && (
          <RespostasGuardadas
            valores={dados.variaveis ?? {}}
            textoAtual={texto}
            aoUsar={t => { setTexto(t); setDeIa(false); setConfirmar([]); setRespostas(false) }}
            aoInserirVariavel={v => setTexto(prev => (prev && !/\s$/.test(prev) ? `${prev} ${v}` : `${prev}${v}`))}
            aoFechar={() => setRespostas(false)}
          />
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Enviar por">
            <button role="radio" aria-checked={canal === 'email'} disabled={!podeEmail} onClick={() => setCanal('email')}
              title={podeEmail ? undefined : 'O hóspede não tem email'}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${canal === 'email' ? 'bg-muted' : ''}`}>
              <Mail className="h-3.5 w-3.5" aria-hidden /> Email
            </button>
            <button role="radio" aria-checked={canal === 'whatsapp'} disabled={!podeWhatsApp} onClick={() => setCanal('whatsapp')}
              title={podeWhatsApp ? undefined : 'O hóspede não tem telefone'}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${canal === 'whatsapp' ? 'bg-muted' : ''}`}>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
            </button>
          </div>
          <button onClick={() => setRegistar(true)}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            <ClipboardPaste className="h-3.5 w-3.5" aria-hidden /> Registar
          </button>
          <button onClick={() => setRespostas(v => !v)} aria-expanded={respostas}
            className={`flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted ${respostas ? 'bg-muted' : ''}`}>
            <BookText className="h-3.5 w-3.5" aria-hidden /> Respostas
          </button>
          <div className="flex-1" />
          {IA_ATIVA && <button onClick={() => (mostrarInstrucao ? sugerir() : setMostrarInstrucao(true))} disabled={aSugerir}
            className="flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary/15 disabled:opacity-60">
            {aSugerir ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {aSugerir ? 'A escrever…' : 'Sugerir resposta'}
          </button>}
        </div>

        {IA_ATIVA && mostrarInstrucao && (
          <div className="flex gap-1.5">
            <input value={instrucao} onChange={e => setInstrucao(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sugerir() } }}
              placeholder="Opcional: o que dizer (ex.: «sim, check-in às 13h sem custo»)"
              aria-label="Indicação para a sugestão"
              className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" autoFocus />
            <button onClick={sugerir} disabled={aSugerir}
              className="rounded-lg bg-primary text-primary-foreground px-3 text-xs font-semibold disabled:opacity-60">Sugerir</button>
          </div>
        )}

        {canal === 'email' && (
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto (opcional)" aria-label="Assunto"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm" maxLength={300} />
        )}

        {deIa && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1">
            <p className="flex items-center gap-1 font-semibold"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Sugestão da IA — revê antes de enviar.</p>
            {confirmar.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5">{confirmar.map((c, i) => <li key={i}>{c}</li>)}</ul>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); enviar() } }}
            placeholder={canal === 'email' ? 'Escreve a mensagem…' : 'Escreve a mensagem de WhatsApp…'}
            aria-label="Mensagem"
            className="flex-1 min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-y max-h-64" />
          <button onClick={enviar} disabled={!texto.trim() || aEnviar || temConfirmar || (canal === 'email' ? !podeEmail : !podeWhatsApp)}
            aria-label={canal === 'whatsapp' && !whatsappDireto ? 'Abrir no WhatsApp' : 'Enviar'}
            className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
            {aEnviar ? <Loader2 className="h-4 w-4 animate-spin" /> : canal === 'whatsapp' && !whatsappDireto ? <ExternalLink className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {temConfirmar
            ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" aria-hidden />Completa as partes [confirmar] antes de enviar.</span>
            : canal === 'whatsapp'
              ? whatsappDireto
                ? 'Sai pelo teu número WhatsApp Business.'
                : caps.whatsappApi
                  ? 'Passaram mais de 24 h desde a última mensagem do hóspede: abre-se o WhatsApp com o texto escrito.'
                  : 'Abre o WhatsApp com o texto escrito; fica guardada aqui.'
              : caps.respostasPorEmail
                ? 'As respostas do hóspede voltam a esta conversa.'
                : 'As respostas do hóspede vão para o teu email.'}
        </p>
      </div>

      {aAssociar && <EscolherReserva aoFechar={() => setAAssociar(false)} aoEscolher={associar} />}

      {registar && (
        <RegistarMensagem
          selecao={selecao}
          canalInicial={dados.reserva ? 'airbnb' : ('canal' in selecao ? selecao.canal : 'outro')}
          aoFechar={() => setRegistar(false)}
          aoRegistar={async direcao => {
            setRegistar(false)
            await carregar(false)
            aoMudar()
            if (direcao === 'entrada') toast.success('Registada. Pede uma sugestão de resposta quando quiseres.')
          }}
        />
      )}
    </div>
  )
}
