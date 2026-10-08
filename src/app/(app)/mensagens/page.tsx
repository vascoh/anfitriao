'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Inbox, Mail, MessageCircle, MessageSquarePlus, Settings2, Sparkles } from 'lucide-react'
import { fmtDate } from '@/lib/utils'
import { CANAL_LABEL, eCanal } from '@/lib/mensagens'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import { ConversaView, EscolherReserva } from '@/components/mensagens/conversa'
import { quando, selecaoDaConversa, selecaoParaQuery, type ConversaLista, type Selecao } from '@/components/mensagens/tipos'

export default function MensagensPage() {
  return (
    <Suspense>
      <Mensagens />
    </Suspense>
  )
}

function lerSelecao(p: URLSearchParams): Selecao | null {
  const reserva = p.get('reserva')
  if (reserva) return { reserva }
  const canal = p.get('canal')
  const contacto = p.get('contacto')
  return eCanal(canal) && contacto ? { canal, contacto } : null
}

function Mensagens() {
  const { user } = useUser()
  const ownerId = user?.id
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const selecao = useMemo(() => lerSelecao(new URLSearchParams(params.toString())), [params])
  const chaveSelecao = selecao ? selecaoParaQuery(selecao) : null

  const [conversas, setConversas] = useState<ConversaLista[] | null>(null)
  const [erro, setErro] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'responder'>('todas')
  const [nova, setNova] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/mensagens')
      if (!res.ok) throw new Error(String(res.status))
      setConversas(await res.json())
      setErro(false)
    } catch {
      setErro(true)
    }
  }, [])

  useEffect(() => {
    if (!ownerId) return
    const t0 = setTimeout(() => { carregar() }, 0)
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar() }, 30_000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [ownerId, carregar])

  function abrir(s: Selecao | null) {
    router.push(s ? `${pathname}?${selecaoParaQuery(s)}` : pathname, { scroll: false })
  }

  const visiveis = (conversas ?? []).filter(c => filtro === 'todas' || c.porResponder)
  const porResponder = (conversas ?? []).filter(c => c.porResponder).length

  return (
    <div className="h-full flex min-h-0">
      {/* Lista — no telemóvel some quando há conversa aberta */}
      <section className={`${selecao ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 shrink-0 border-r border-border min-h-0`}>
        <header className="px-4 py-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
            <div className="flex items-center gap-1">
              <Link href="/mensagens/whatsapp" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Ligar WhatsApp e email" title="Ligar WhatsApp e email">
                <Settings2 className="h-4 w-4" />
              </Link>
              <button onClick={() => setNova(true)} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> Nova
              </button>
            </div>
          </div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium" role="tablist" aria-label="Filtrar conversas">
            {(['todas', 'responder'] as const).map(f => (
              <button key={f} role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
                className={`flex-1 rounded-md px-2 py-1.5 ${filtro === f ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
                {f === 'todas' ? 'Todas' : `Por responder${porResponder ? ` (${porResponder})` : ''}`}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          {erro && !conversas ? (
            <ErroAoCarregar oQue="as mensagens" aviso="Não assumas que não há mensagens por responder." aoTentar={carregar} />
          ) : !conversas ? (
            <ul className="animate-pulse" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-4 py-3 border-b border-border flex flex-col gap-2">
                  <div className="h-3.5 w-32 rounded bg-muted" /><div className="h-3 w-48 rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : visiveis.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 px-6 py-16 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden />
              {filtro === 'responder' ? (
                <p>Nada por responder.</p>
              ) : (
                <>
                  <p className="font-medium text-foreground">Ainda sem conversas</p>
                  <p className="max-w-xs leading-relaxed">
                    Escreve a um hóspede por email ou WhatsApp, ou cola aqui o que te mandou pelo Airbnb ou
                    pela Booking.com — a IA sugere a resposta na língua dele.
                  </p>
                  <button onClick={() => setNova(true)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                    Começar uma conversa
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul>
              {visiveis.map(c => {
                const s = selecaoDaConversa(c)
                const ativa = s && chaveSelecao === selecaoParaQuery(s)
                const Icone = c.canal === 'email' ? Mail : MessageCircle
                return (
                  <li key={c.chave}>
                    <button onClick={() => abrir(s)} aria-current={ativa ? 'true' : undefined}
                      className={`w-full text-left px-4 py-3 border-b border-border flex gap-3 hover:bg-muted/60 ${ativa ? 'bg-muted' : ''}`}>
                      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold" aria-hidden>
                        {c.nome.trim().charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-sm ${c.porLer ? 'font-semibold' : 'font-medium'}`}>{c.nome}</p>
                          <time className="text-[11px] text-muted-foreground shrink-0" dateTime={c.ultima.criado_em}>{quando(c.ultima.criado_em)}</time>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.propriedade && c.check_in && c.check_out
                            ? `${c.propriedade} · ${fmtDate(c.check_in)} – ${fmtDate(c.check_out)}`
                            : c.reserva_id ? 'Reserva' : 'Sem reserva associada'}
                        </p>
                        <p className={`mt-0.5 text-xs truncate flex items-center gap-1 ${c.porLer ? 'text-foreground' : 'text-muted-foreground'}`}>
                          <Icone className="h-3 w-3 shrink-0" aria-label={CANAL_LABEL[c.canal]} />
                          {c.ultima.direcao === 'saida' && <span className="shrink-0">Tu:</span>}
                          {c.ultima.sugerida_por_ia && <Sparkles className="h-3 w-3 shrink-0" aria-label="Sugerida pela IA" />}
                          <span className="truncate">{c.ultima.corpo}</span>
                        </p>
                      </div>
                      {c.porLer > 0 && (
                        <span className="self-center shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center"
                          aria-label={`${c.porLer} por ler`}>{c.porLer}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Conversa */}
      <section className={`${selecao ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0`}>
        {selecao ? (
          <ConversaView key={chaveSelecao} selecao={selecao} aoVoltar={() => abrir(null)} aoMudar={carregar} />
        ) : (
          <div className="m-auto text-center text-sm text-muted-foreground flex flex-col items-center gap-2 px-6">
            <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p>Escolhe uma conversa.</p>
          </div>
        )}
      </section>

      {nova && (
        <EscolherReserva
          titulo="Nova conversa — escolhe a reserva"
          aoFechar={() => setNova(false)}
          aoEscolher={id => { setNova(false); abrir({ reserva: id }) }}
        />
      )}
    </div>
  )
}
