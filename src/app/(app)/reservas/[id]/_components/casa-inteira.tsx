'use client'

import Link from 'next/link'
import { fmtMoney } from '@/lib/utils'
import type { Booking, Property } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/labels'

/** Esta reserva é um quarto de uma casa alugada por inteiro: mostra o grupo. */
export function CasaInteira({ booking, grupo }: { booking: Booking; grupo: { reservas: Booking[]; props: Property[] } }) {
  const vivas = grupo.reservas.filter(r => r.estado !== 'cancelada' && r.estado !== 'no_show')
  const base = vivas.length > 0 ? vivas : grupo.reservas
  const totalGrupo = base.reduce((s, r) => s + (r.preco_total ?? 0), 0)
  const pagoGrupo = base.reduce((s, r) => s + (r.preco_pago ?? 0), 0)
  const casa = grupo.props.find(p => p.id === grupo.props.find(x => x.id === booking.propriedade_id)?.parent_id)

  return (
    <div className="mx-4 rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          {casa ? `${casa.nome} — casa inteira` : 'Reserva de casa inteira'}
        </p>
        <span className="text-xs text-muted-foreground shrink-0">
          {base.length} quarto{base.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Esta é <strong>uma</strong> das reservas do grupo. Os valores em baixo são
        deste quarto; o hóspede reservou {fmtMoney(totalGrupo)} no total
        {pagoGrupo > 0 && `, dos quais já pagou ${fmtMoney(pagoGrupo)}`}.
      </p>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {grupo.reservas.map(r => {
          const quarto = grupo.props.find(p => p.id === r.propriedade_id)
          const cancelada = r.estado === 'cancelada' || r.estado === 'no_show'
          return (
            <Link
              key={r.id}
              href={`/reservas/${r.id}`}
              className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                r.id === booking.id ? 'bg-muted/60 font-medium' : 'hover:bg-muted/40'
              }`}
            >
              <span className={`flex-1 truncate ${cancelada ? 'line-through text-muted-foreground' : ''}`}>
                {quarto?.nome ?? 'Quarto'}
              </span>
              <span className="text-muted-foreground">{STATUS_LABEL[r.estado]}</span>
              <span className="tabular-nums">{fmtMoney(r.preco_total)}</span>
            </Link>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cancelar aqui cancela só este quarto. A fatura, essa, é uma só para o grupo.
      </p>
    </div>
  )
}
