'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Download, ArrowLeft, Info, AlertTriangle } from 'lucide-react'
import { fetchBookings, fetchProperties } from '@/lib/fetcher'
import { today, fmtDate, fmtMoney } from '@/lib/utils'
import { regraPara, calcularTmt, REGRAS_TMT } from '@/lib/taxa-turistica'
import { geraObrigacoesDeHospede } from '@/lib/reservations'
import { mesAnterior, nomeMes } from '@/lib/relatorio-mensal'
import { escCsv } from '@/lib/siba'
import type { Booking, Property } from '@/lib/types'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'

export default function TaxaTuristicaPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [bookings, setBookings] = useState<Booking[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const inicial = mesAnterior(today())
  const [ano, setAno] = useState(inicial.ano)
  const [mes, setMes] = useState(inicial.mes)

  /** Hóspedes isentos declarados pelo anfitrião, por reserva. */
  const [isentos, setIsentos] = useState<Record<string, number>>({})

  /* Só o mês que se está a declarar.
   *
   * Vinha tudo — e "tudo" para o PostgREST são as 1000 linhas mais recentes,
   * sem aviso de que há mais. Num alojamento com movimento, declarar um mês de
   * há um ano dava uma tabela vazia ou pela metade, e o valor entregue à
   * câmara saía por baixo do devido. */
  useEffect(() => {
    if (!ownerId) return
    /* Sem `setLoading(true)` ao mudar de mês: a tabela do mês anterior fica no
     * ecrã até chegar a nova, em vez de piscar para vazio. */
    const de = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    const ate = mes === 11 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 2).padStart(2, '0')}-01`
    /* O `catch` não é cortesia: sem ele, uma falha de rede não mexia em
     * `loading` (o `setLoading(false)` vive dentro do `then`) e a página ficava
     * presa no esqueleto para sempre. Ao mudar de mês era pior — a tabela do
     * mês anterior continuava no ecrã por baixo do cabeçalho do mês novo. Numa
     * página de onde sai um valor para a câmara, um número que não chegou não
     * pode passar por um número que é zero. */
    Promise.all([fetchBookings({ de, ate }), fetchProperties()])
      .then(([b, p]) => { setBookings(b); setProps(p); setErro(false) })
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }, [ownerId, ano, mes])

  const mapa = useMemo(() => {
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    const fim = mes === 11
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 2).padStart(2, '0')}-01`

    const linhas: Array<{
      booking: Booking
      propriedade: Property
      valor: number
      noites: number
      avisos: string[]
    }> = []
    const porConfigurar = new Set<string>()

    for (const b of bookings) {
      if (b.estado === 'cancelada' || b.estado === 'no_show') continue
      /* A taxa é por pessoa e por noite: um quarto fechado não tem quem a
       * pague. Sem isto, um bloqueio de 21 noites vindo do feed do Amenitiz
       * entrava no mapa e o anfitrião declarava — e pagava — por um hóspede
       * que nunca existiu. Ver `geraObrigacoesDeHospede`. */
      if (!geraObrigacoesDeHospede(b)) continue
      if (b.check_in >= fim || b.check_out <= inicio) continue

      const p = props.find(x => x.id === b.propriedade_id)
      if (!p) continue

      const regra = regraPara(p.cidade)
      if (!regra) {
        if (p.cidade) porConfigurar.add(p.cidade)
        continue
      }

      const calc = calcularTmt(b, regra, { ano, mes, pessoasIsentas: isentos[b.id] ?? 0 })
      if (calc.noitesTributaveis === 0) continue

      linhas.push({
        booking: b,
        propriedade: p,
        valor: calc.valor,
        noites: calc.noitesTributaveis,
        avisos: calc.avisos,
      })
    }

    linhas.sort((a, b) => a.booking.check_in.localeCompare(b.booking.check_in))

    return {
      linhas,
      total: Math.round(linhas.reduce((s, l) => s + l.valor, 0) * 100) / 100,
      porConfigurar: [...porConfigurar].sort(),
    }
  }, [bookings, props, ano, mes, isentos])

  function descarregarCsv() {
    const linhas = [
      ['Reserva', 'Alojamento', 'Concelho', 'Check-in', 'Check-out', 'Hóspedes', 'Noites', 'Valor (EUR)']
        .map(escCsv).join(','),
      ...mapa.linhas.map(l => [
        l.booking.id,
        l.propriedade.nome,
        l.propriedade.cidade,
        l.booking.check_in,
        l.booking.check_out,
        String(Math.max(1, l.booking.num_hospedes || 1) - (isentos[l.booking.id] ?? 0)),
        String(l.noites),
        l.valor.toFixed(2),
      ].map(escCsv).join(',')),
      ['TOTAL', '', '', '', '', '', '', mapa.total.toFixed(2)].map(escCsv).join(','),
    ]
    const csv = '﻿' + linhas.join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `taxa-turistica-${ano}-${String(mes + 1).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function mudarMes(delta: number) {
    const total = ano * 12 + mes + delta
    setAno(Math.floor(total / 12))
    setMes(((total % 12) + 12) % 12)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (erro) {
    return (
      <ErroAoCarregar
        oQue="as reservas deste mês"
        aviso="Não declares nada a partir desta página enquanto não carregar: uma tabela vazia por falha de rede é indistinguível de um mês sem dormidas."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/conformidade"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Conformidade
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Taxa turística</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mapa mensal por reserva, pronto para a declaração no portal do teu município.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-xl border border-border bg-card">
          <button
            type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"
            className="min-h-11 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >←</button>
          <span className="min-w-[10rem] px-2 text-center text-sm font-semibold capitalize">
            {nomeMes(mes)} {ano}
          </span>
          <button
            type="button" onClick={() => mudarMes(1)} aria-label="Mês seguinte"
            className="min-h-11 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >→</button>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-2">
          <span className="text-xs text-muted-foreground">A entregar</span>
          <span className="ml-2 text-lg font-bold tabular">{fmtMoney(mapa.total)}</span>
        </div>
      </div>

      {/* A pergunta que decide se este valor está certo: a taxa está no preço?
        * A app assume que não, e isso muda o que o anfitrião tem de fazer com o
        * hóspede. Dito aqui, que é onde ele olha para o número. */}
      <div className="flex gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            Esta taxa não está incluída no preço das tuas reservas
          </p>
          <p className="mt-1">
            O preço que a aplicação calcula soma as noites, a taxa de limpeza e as regras de preço
            — e nunca lhe soma a taxa turística. O valor acima é o que{' '}
            <strong className="text-foreground">cobras ao hóspede à parte</strong>, tipicamente à
            chegada, e entregas depois ao município.
          </p>
          <p className="mt-2">
            Por isso a <strong className="text-foreground">fatura também não a leva</strong>: a
            fatura-recibo documenta o que foi pago através da aplicação. Somá-la lá não mudava o
            total do documento, mudava a repartição — tirava valor à linha de alojamento, que é
            tributada a 6 %, e punha-o numa linha não sujeita a IVA. O total ficava certo e o IVA
            liquidado ficava a menos, que é o erro que não se apanha a conferir a fatura.
          </p>
          <p className="mt-2">
            Se preferires cobrar a taxa dentro do preço da reserva, sobe o preço e{' '}
            <strong className="text-foreground">declara aqui na mesma</strong> — o município recebe
            o mesmo, e a fatura passa a incluir esse valor como alojamento.
          </p>
        </div>
      </div>

      {mapa.porConfigurar.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-foreground">
              {mapa.porConfigurar.length === 1 ? 'Concelho não configurado' : 'Concelhos não configurados'}
            </p>
            <p className="mt-1 text-muted-foreground">
              Ainda não temos regra verificada para {mapa.porConfigurar.join(', ')}. As reservas
              nesses alojamentos <strong>não entram neste mapa</strong> — preferimos não mostrar
              nada a mostrar um valor errado. Confirma no regulamento do teu município e avisa-nos
              em suporte@anfitrioes.pt para o acrescentarmos.
            </p>
          </div>
        </div>
      )}

      {mapa.linhas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">Nada a declarar neste mês</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Não há noites tributáveis em alojamentos com taxa configurada. Confirma na mesma se o
            teu município exige declaração de valor zero.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Alojamento</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Estadia</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Noites</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Isentos</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {mapa.linhas.map(l => {
                  const pessoas = Math.max(1, l.booking.num_hospedes || 1)
                  return (
                    <tr key={l.booking.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <span className="block font-medium">{l.propriedade.nome}</span>
                        <span className="block text-xs text-muted-foreground">{l.propriedade.cidade}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(l.booking.check_in)} → {fmtDate(l.booking.check_out)}
                        <span className="block">{pessoas} {pessoas === 1 ? 'hóspede' : 'hóspedes'}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular">{l.noites}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={pessoas}
                          value={isentos[l.booking.id] ?? 0}
                          onChange={e => setIsentos(prev => ({
                            ...prev,
                            [l.booking.id]: Math.max(0, Math.min(pessoas, Number(e.target.value) || 0)),
                          }))}
                          aria-label={`Hóspedes isentos na reserva de ${l.propriedade.nome}`}
                          className="min-h-11 w-16 rounded-lg border border-border bg-background px-2 text-right text-sm tabular outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular">{fmtMoney(l.valor)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40 font-bold">
                  <td className="px-4 py-3" colSpan={4}>Total a entregar ao município</td>
                  <td className="px-4 py-3 text-right tabular">{fmtMoney(mapa.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={descarregarCsv}
          disabled={mapa.linhas.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Descarregar CSV
        </button>
      </div>

      <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Como isto é calculado</p>
          <p className="mt-1">
            A taxa é cobrada por pessoa e por noite, até ao limite fixado por cada município, e a
            sazonalidade é aplicada noite a noite. Os menores estão isentos, mas a aplicação não
            sabe a idade de cada hóspede — o boletim SIBA só recolhe a data de nascimento de quem
            faz o check-in. Por isso o número de isentos é declarado por ti, na coluna acima.
          </p>
          <p className="mt-3 font-semibold text-foreground">Concelhos configurados</p>
          <ul className="mt-1 space-y-0.5">
            {REGRAS_TMT.map(r => (
              <li key={r.concelho}>
                <strong className="text-foreground">{r.concelho}</strong>
                {' — '}
                {r.estacoes
                  ? r.estacoes.map(e => `${e.valor} €`).join(' / ') + ' por noite (sazonal)'
                  : `${r.valor} € por noite`}
                {`, até ${r.maxNoites} noites, isentos os menores de ${r.isencaoIdade}`}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Os regulamentos municipais mudam sem aviso central. Confirma sempre no regulamento do
            teu município antes de entregar.
          </p>
        </div>
      </div>
    </div>
  )
}
