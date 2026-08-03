'use client'

import { useState, useMemo } from 'react'
import { Home, Users, Check, Loader2 } from 'lucide-react'
import { fmtMoney, today, addDays, nights } from '@/lib/utils'
import { calculatePriceWithRules } from '@/lib/reservations'
import { disponibilidadeDosQuartos, capacidadeTotal } from '@/lib/grupos'
import type { Property, Booking, PriceRule, Tarifa, PlatformRate } from '@/lib/types'

/**
 * Reservar a casa inteira, do lado do hóspede.
 *
 * Até aqui, quem quisesse a casa toda tinha de reservar quarto a quarto: três
 * formulários, três pedidos, e a possibilidade real de ficar com dois dos três
 * — porque entre o primeiro e o terceiro nada estava reservado.
 *
 * O preço é calculado aqui só para mostrar. Quem manda é o servidor, que
 * recalcula tudo antes de aceitar: um preço vindo do browser é uma sugestão do
 * cliente, não um facto.
 */
export default function CasaInteiraClient({
  casa, quartos, bookings, priceRules, tarifas, platformRates, minNoites,
}: {
  casa: Property
  quartos: Property[]
  bookings: Booking[]
  priceRules: PriceRule[]
  tarifas: Tarifa[]
  platformRates: PlatformRate[]
  minNoites: number
}) {
  const [aberto, setAberto] = useState(false)
  const [checkIn, setCheckIn] = useState(addDays(today(), 1))
  const [checkOut, setCheckOut] = useState(addDays(today(), 3))
  const [pessoas, setPessoas] = useState(2)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [notas, setNotas] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)

  const capacidade = capacidadeTotal(quartos)
  const datasValidas = Boolean(checkIn && checkOut && checkIn < checkOut)
  const noites = datasValidas ? nights(checkIn, checkOut) : 0

  const disponibilidade = useMemo(
    () => (datasValidas ? disponibilidadeDosQuartos(quartos, bookings, checkIn, checkOut) : []),
    [quartos, bookings, checkIn, checkOut, datasValidas],
  )

  const todosLivres = disponibilidade.length > 0 && disponibilidade.every(d => d.livre)
  const ocupados = disponibilidade.filter(d => !d.livre).map(d => d.quarto.nome)

  const preco = useMemo(() => {
    if (!datasValidas || !todosLivres) return 0
    const total = quartos.reduce(
      (s, q) => s + calculatePriceWithRules(q, checkIn, checkOut, priceRules, tarifas, platformRates, 'direto').total,
      0,
    )
    return Math.round(total * 100) / 100
  }, [quartos, checkIn, checkOut, priceRules, tarifas, platformRates, datasValidas, todosLivres])

  const cabe = pessoas <= capacidade
  const noitesSuficientes = noites >= minNoites
  const podeEnviar = datasValidas && todosLivres && cabe && noitesSuficientes && nome.trim() && email.trim()

  async function enviar() {
    setAEnviar(true)
    setErro('')
    try {
      const res = await fetch('/api/book/grupo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: { nome: nome.trim(), email: email.trim(), telefone: telefone.trim() || undefined },
          booking: {
            propriedade_id: casa.id,
            check_in: checkIn,
            check_out: checkOut,
            num_hospedes: pessoas,
            notas: notas.trim() || undefined,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(json.error ?? 'Não foi possível enviar o pedido.')
        return
      }
      setFeito(true)
    } catch {
      setErro('Não foi possível enviar o pedido. Tenta outra vez.')
    } finally {
      setAEnviar(false)
    }
  }

  if (feito) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-500/10">
          <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-bold">Pedido enviado</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Reservaste <strong>{casa.nome}</strong> por inteiro — {quartos.length} quartos para {pessoas}{' '}
          {pessoas === 1 ? 'pessoa' : 'pessoas'}, de {checkIn} a {checkOut}.
          O anfitrião confirma e recebes um email.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Home className="h-6 w-6 text-primary" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Reservar a casa inteira</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {quartos.length} quartos · até {capacidade} pessoas · num só pedido
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-primary">
          {aberto ? 'Fechar' : 'Ver'}
        </span>
      </button>

      {aberto && (
        <div className="border-t border-primary/20 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Entrada</span>
              <input
                type="date"
                value={checkIn}
                min={today()}
                onChange={e => setCheckIn(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Saída</span>
              <input
                type="date"
                value={checkOut}
                min={addDays(checkIn, 1)}
                onChange={e => setCheckOut(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Pessoas</span>
              <input
                type="number"
                min={1}
                max={capacidade}
                value={pessoas}
                onChange={e => setPessoas(Math.max(1, Number(e.target.value)))}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
              />
            </label>
          </div>

          {/* O que se sabe antes de pedir seja o que for ao hóspede. */}
          <div className="mt-4 space-y-2">
            {!cabe && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                A casa leva {capacidade} {capacidade === 1 ? 'pessoa' : 'pessoas'}.
              </p>
            )}
            {datasValidas && !noitesSuficientes && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                Estadia mínima de {minNoites} {minNoites === 1 ? 'noite' : 'noites'}.
              </p>
            )}
            {datasValidas && ocupados.length > 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                Nestas datas a casa não está toda livre — {ocupados.join(', ')} já {ocupados.length === 1 ? 'está reservado' : 'estão reservados'}.
                Podes reservar os quartos livres em baixo.
              </p>
            )}
          </div>

          {datasValidas && todosLivres && cabe && (
            <>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-background">
                {quartos.map(q => (
                  <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {q.nome}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{q.capacidade} pax</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl bg-background px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {noites} {noites === 1 ? 'noite' : 'noites'} · casa inteira
                </span>
                <span className="text-xl font-bold tabular-nums">{fmtMoney(preco)}</span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome</span>
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefone (opcional)</span>
                  <input
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Mensagem (opcional)</span>
                  <input
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
              </div>

              {erro && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}

              <button
                type="button"
                onClick={enviar}
                disabled={!podeEnviar || aEnviar}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {aEnviar ? 'A enviar…' : 'Pedir a casa inteira'}
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                É um pedido — o anfitrião confirma antes de haver qualquer pagamento.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
