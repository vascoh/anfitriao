'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Download, ExternalLink, ArrowLeft, Info } from 'lucide-react'
import { fetchBookings, fetchGuests, fetchProperties } from '@/lib/fetcher'
import { today, fmtDate } from '@/lib/utils'
import { gerarMapaIne, prazoIne } from '@/lib/ine'
import { mesAnterior, nomeMes } from '@/lib/relatorio-mensal'
import { escCsv } from '@/lib/siba'
import type { Booking, Guest, Property } from '@/lib/types'

const URL_WEBINQ = 'https://webinq.ine.pt/'

export default function IneePage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [bookings, setBookings] = useState<Booking[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [props, setProps] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Por omissão mostra o mês anterior — é esse que está por declarar
  const inicial = mesAnterior(today())
  const [ano, setAno] = useState(inicial.ano)
  const [mes, setMes] = useState(inicial.mes)

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchBookings(), fetchGuests(), fetchProperties()]).then(([b, g, p]) => {
      setBookings(b); setGuests(g); setProps(p); setLoading(false)
    })
  }, [ownerId])

  const mapa = useMemo(
    () => gerarMapaIne(bookings, guests, props, ano, mes),
    [bookings, guests, props, ano, mes],
  )

  const prazo = prazoIne(ano, mes)
  const emAtraso = today() > prazo

  function descarregarCsv() {
    const linhas = [
      ['País de residência', 'Hóspedes', 'Dormidas'].map(escCsv).join(','),
      ...mapa.linhas.map(l => [l.pais, String(l.hospedes), String(l.dormidas)].map(escCsv).join(',')),
      ['TOTAL', String(mapa.totalHospedes), String(mapa.totalDormidas)].map(escCsv).join(','),
    ]
    const csv = '﻿' + linhas.join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ine-iphh-${ano}-${String(mes + 1).padStart(2, '0')}.csv`
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
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Inquérito do INE</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hóspedes e dormidas por país, no formato do IPHH. A resposta é obrigatória até ao dia 10
          do mês seguinte, mesmo quando não houve movimento.
        </p>
      </div>

      {/* Seletor de mês */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="min-h-11 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Mês anterior"
          >
            ←
          </button>
          <span className="min-w-[10rem] px-2 text-center text-sm font-semibold capitalize">
            {nomeMes(mes)} {ano}
          </span>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="min-h-11 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Mês seguinte"
          >
            →
          </button>
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            emAtraso
              ? 'bg-red-500/10 text-red-700 dark:text-red-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {emAtraso ? 'Prazo ultrapassado a ' : 'Prazo: '}
          {fmtDate(prazo, { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Totais */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Hóspedes', String(mapa.totalHospedes)],
          ['Dormidas', String(mapa.totalDormidas)],
          ['Estadia média', mapa.estadiaMedia ? `${mapa.estadiaMedia} noites` : '—'],
        ].map(([label, valor]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-2xl font-bold tabular">{valor}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {mapa.semMovimento ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">Sem movimento neste mês</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Continuas obrigado a responder ao INE, declarando zero. A resposta faz-se no WebInq.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-5 py-3 font-semibold">País de residência</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Hóspedes</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Dormidas</th>
                </tr>
              </thead>
              <tbody>
                {mapa.linhas.map(l => (
                  <tr key={l.pais} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">{l.pais}</td>
                    <td className="px-5 py-3 text-right tabular">{l.hospedes}</td>
                    <td className="px-5 py-3 text-right tabular">{l.dormidas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40 font-bold">
                  <td className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right tabular">{mapa.totalHospedes}</td>
                  <td className="px-5 py-3 text-right tabular">{mapa.totalDormidas}</td>
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
          disabled={mapa.semMovimento}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Descarregar CSV
        </button>
        <a
          href={URL_WEBINQ}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Abrir WebInq
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Confirma o país antes de submeter</p>
          <p className="mt-1">
            O INE pede o <strong>país de residência</strong>, que nem sempre coincide com a
            nacionalidade. O Anfitrião só recolhe a nacionalidade, porque é esse o campo do boletim
            de alojamento — usamo-la como aproximação. Se tens hóspedes a residir num país
            diferente do da nacionalidade, corrige no WebInq.
          </p>
        </div>
      </div>
    </div>
  )
}
