'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { fmtMoney, nights, today, uuid } from '@/lib/utils'
import { addDays, calculatePriceWithRules, getPriceForDay } from '@/lib/reservations'
import {
  SEM_SELECAO, dentroDaSelecao, diaDisponivel, escolherDia, gradeDoMes, somarMeses, type Selecao,
} from '@/lib/calendario-reserva'
import type { PriceRule, Tarifa, PlatformRate } from '@/lib/types'
import type { PropriedadePublica } from '@/lib/property-publica'
import type { SiteLang } from '@/lib/i18n'
import { DIAS_SEMANA, MESES, tr } from '@/lib/i18n-reserva'

interface Props {
  prop: PropriedadePublica
  ocupadas: string[]
  priceRules: PriceRule[]
  tarifas: Tarifa[]
  platformRates: PlatformRate[]
  minNoites: number
  antecedenciaDias: number
  pagamentos: boolean
  lang: SiteLang
}

function fmtDia(dia: string, lang: SiteLang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'short' })
    .format(new Date(`${dia}T00:00:00`))
}

/**
 * Cartão de reserva do site: o calendário mostra o preço de cada noite, o
 * hóspede escolhe chegada e saída, e o total sai do mesmo cálculo que o
 * servidor usa para gravar a reserva (`calculatePriceWithRules`).
 */
export function Reservar({ prop, ocupadas, priceRules, tarifas, platformRates, minNoites, antecedenciaDias, pagamentos, lang }: Props) {
  const router = useRouter()
  const ocupadasSet = useMemo(() => new Set(ocupadas), [ocupadas])
  const ordenadas = useMemo(() => [...ocupadas].sort(), [ocupadas])
  const minimo = addDays(today(), antecedenciaDias)
  const [mes, setMes] = useState(() => {
    const [a, m] = minimo.split('-').map(Number)
    return { ano: a, mes: m - 1 }
  })
  const [sel, setSel] = useState<Selecao>(SEM_SELECAO)
  const [atravessa, setAtravessa] = useState(false)
  const [hospedes, setHospedes] = useState(() => Math.min(2, Math.max(1, prop.capacidade)))
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviar, setEnviar] = useState<false | 'pedido' | 'pagamento'>(false)
  const [erro, setErro] = useState<string | null>(null)

  const grelha = useMemo(() => gradeDoMes(mes.ano, mes.mes), [mes])
  const precos = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of grelha) if (d) m.set(d, getPriceForDay(prop, d, priceRules).preco)
    return m
  }, [grelha, prop, priceRules])
  const maisBarato = useMemo(() => {
    const livres = grelha.filter((d): d is string => !!d && d >= minimo && !ocupadasSet.has(d)).map(d => precos.get(d)!)
    return livres.length ? Math.min(...livres) : null
  }, [grelha, precos, minimo, ocupadasSet])

  const numNoites = sel.entrada && sel.saida ? nights(sel.entrada, sel.saida) : 0
  const curta = numNoites > 0 && numNoites < minNoites
  const preco = useMemo(() => (
    sel.entrada && sel.saida && numNoites > 0
      ? calculatePriceWithRules(prop, sel.entrada, sel.saida, priceRules, tarifas, platformRates, 'direto')
      : null
  ), [prop, sel, numNoites, priceRules, tarifas, platformRates])
  const pronto = Boolean(preco && !curta && nome.trim() && email.trim())
  const primeiroMes = mes.ano * 12 + mes.mes <= Number(minimo.slice(0, 4)) * 12 + Number(minimo.slice(5, 7)) - 1

  function clicar(dia: string) {
    const r = escolherDia(sel, dia, ordenadas)
    setSel(r.selecao)
    setAtravessa(r.atravessa)
  }

  async function submeter(modo: 'pedido' | 'pagamento') {
    if (!pronto || !sel.entrada || !sel.saida || !preco) return
    setEnviar(modo)
    setErro(null)
    const guest = { nome: nome.trim(), email: email.trim(), telefone: telefone.trim() || undefined, notas: mensagem.trim() || undefined }
    const booking = {
      propriedade_id: prop.id, check_in: sel.entrada, check_out: sel.saida, num_hospedes: hospedes,
      notas: mensagem.trim() || undefined,
    }
    try {
      if (modo === 'pagamento') {
        const res = await fetch('/api/book/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest, booking }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.url) throw new Error(typeof body?.error === 'string' ? body.error : '')
        window.location.href = body.url
        return
      }
      // Os ids e o preço são atribuídos pelo servidor (ver lib/booking-request.ts).
      const agora = new Date().toISOString()
      const res = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: { ...guest, tags: ['novo'], criado_em: agora },
          booking: {
            ...booking, estado: 'pendente', origem: 'direto', preco_total: preco.total, preco_pago: 0, criado_em: agora,
            historico: [{ id: uuid(), data: agora, tipo: 'criada', descricao: 'Reserva criada via website direto' }],
          },
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : '')
      router.push(`/book/${prop.id}/confirmacao?b=${body?.bookingId ?? ''}&nome=${encodeURIComponent(nome.trim())}`)
    } catch (e) {
      setEnviar(false)
      setErro(e instanceof Error && e.message ? e.message : tr(lang, 'erro_envio'))
    }
  }

  const instrucao = !sel.entrada || sel.saida ? tr(lang, 'escolher_entrada') : tr(lang, 'escolher_saida')
  const campo = 'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {preco && !curta
            ? <><span className="site-num text-2xl font-semibold text-foreground">{fmtMoney(preco.total)}</span> · {numNoites} {numNoites === 1 ? tr(lang, 'noite') : tr(lang, 'noites')}</>
            : <>{tr(lang, 'desde')} <span className="site-num text-2xl font-semibold text-foreground">{fmtMoney(maisBarato ?? prop.preco_base)}</span> / {tr(lang, 'noite')}</>}
        </p>
        {sel.entrada && (
          <button type="button" onClick={() => { setSel(SEM_SELECAO); setAtravessa(false) }}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {tr(lang, 'limpar')}
          </button>
        )}
      </div>

      {/* Calendário com o preço de cada noite */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button type="button" disabled={primeiroMes} onClick={() => setMes(m => somarMeses(m.ano, m.mes, -1))}
            aria-label={tr(lang, 'mes_anterior')}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="text-sm font-semibold first-letter:uppercase" aria-live="polite">{MESES[lang][mes.mes]} {mes.ano}</p>
          <button type="button" onClick={() => setMes(m => somarMeses(m.ano, m.mes, 1))} aria-label={tr(lang, 'mes_seguinte')}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
          {DIAS_SEMANA[lang].map((d, i) => <span key={i} aria-hidden>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grelha.map((dia, i) => {
            if (!dia) return <span key={i} />
            const livre = diaDisponivel(dia, sel, minimo, ocupadasSet, ordenadas)
            const ponta = dia === sel.entrada || dia === sel.saida
            const meio = dentroDaSelecao(dia, sel)
            const ocupado = ocupadasSet.has(dia) && dia >= minimo
            const valor = precos.get(dia)!
            const barato = livre && !ponta && !meio && valor === maisBarato
            return (
              <button key={dia} type="button" disabled={!livre} onClick={() => clicar(dia)}
                aria-pressed={ponta || undefined}
                aria-label={`${fmtDia(dia, lang)}${ocupado ? ` — ${tr(lang, 'ocupado')}` : ` — ${fmtMoney(valor)}`}`}
                className={[
                  'flex h-12 flex-col items-center justify-center rounded-xl text-sm leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ponta ? 'bg-primary text-primary-foreground'
                    : meio ? 'rounded-none bg-primary/10 text-foreground'
                    : livre ? 'hover:bg-muted' : 'cursor-not-allowed text-muted-foreground/40',
                ].join(' ')}>
                <span className={`site-num ${ocupado && !livre ? 'line-through' : ''} ${ponta ? 'font-semibold' : 'font-medium'}`}>{Number(dia.slice(8))}</span>
                {!ocupado && dia >= minimo && (
                  <span className={`site-num mt-1 text-[10px] ${ponta ? 'text-primary-foreground/80' : barato ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                    {Math.round(valor)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground" role="status">
          {atravessa ? <span className="text-destructive">{tr(lang, 'intervalo_ocupado')}</span>
            : sel.entrada && sel.saida ? `${fmtDia(sel.entrada, lang)} → ${fmtDia(sel.saida, lang)}`
            : `${instrucao} · ${tr(lang, 'legenda_preco')} (€)`}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium">{tr(lang, 'numero_hospedes')}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setHospedes(h => Math.max(1, h - 1))} disabled={hospedes <= 1}
            aria-label="−" className="rounded-full border border-border p-1.5 disabled:opacity-30"><Minus className="h-3.5 w-3.5" aria-hidden /></button>
          <span className="site-num w-5 text-center text-sm font-semibold" aria-live="polite">{hospedes}</span>
          <button type="button" onClick={() => setHospedes(h => Math.min(prop.capacidade, h + 1))} disabled={hospedes >= prop.capacidade}
            aria-label="+" className="rounded-full border border-border p-1.5 disabled:opacity-30"><Plus className="h-3.5 w-3.5" aria-hidden /></button>
        </div>
      </div>

      {curta && <p className="rounded-xl bg-muted px-3.5 py-2.5 text-xs">{tr(lang, 'minimo', { n: minNoites })}</p>}

      {preco && !curta && (
        <dl className="site-num flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{numNoites === 1 ? tr(lang, 'noite_x', { preco: fmtMoney(preco.preco_noite) }) : tr(lang, 'noites_x', { n: numNoites, preco: fmtMoney(preco.preco_noite) })}</dt>
            <dd>{fmtMoney(preco.subtotal_noites)}</dd>
          </div>
          {preco.ajuste_valor !== 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">{tr(lang, 'ajuste')}</dt><dd>{fmtMoney(preco.ajuste_valor)}</dd></div>
          )}
          {preco.taxa_limpeza > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">{tr(lang, 'limpeza')}</dt><dd>{fmtMoney(preco.taxa_limpeza)}</dd></div>
          )}
          {preco.plataforma_ajuste !== 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">{tr(lang, 'ajuste')}</dt><dd>{fmtMoney(preco.plataforma_ajuste)}</dd></div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-2.5 font-semibold">
            <dt>{tr(lang, 'total')}</dt><dd>{fmtMoney(preco.total)}</dd>
          </div>
        </dl>
      )}

      {preco && !curta && (
        <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void submeter(pagamentos ? 'pagamento' : 'pedido') }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium">{tr(lang, 'nome')}
              <input required autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">{tr(lang, 'email')}
              <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={campo} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium">{tr(lang, 'telefone')}
            <input type="tel" autoComplete="tel" value={telefone} onChange={e => setTelefone(e.target.value)} className={campo} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">{tr(lang, 'mensagem')}
            <textarea rows={2} value={mensagem} onChange={e => setMensagem(e.target.value)} className={`${campo} resize-none`} />
          </label>
          {erro && <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{erro}</p>}
          <button type="submit" disabled={!pronto || enviar !== false}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {enviar ? tr(lang, 'a_enviar') : pagamentos ? tr(lang, 'pagar') : tr(lang, 'pedir')}
          </button>
          {pagamentos && (
            <button type="button" disabled={!pronto || enviar !== false} onClick={() => void submeter('pedido')}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
              {tr(lang, 'pedir')}
            </button>
          )}
          <p className="text-center text-[11px] text-muted-foreground">{pagamentos ? tr(lang, 'nota_pagamento') : tr(lang, 'nota_pedido')}</p>
        </form>
      )}
    </div>
  )
}
