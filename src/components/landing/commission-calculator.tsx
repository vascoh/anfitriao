'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Euro, TrendingDown, TrendingUp } from 'lucide-react'

const PLAN_PRICE = 19 // €/mês

export function CommissionCalculator() {
  const [revenue, setRevenue] = useState(2000)

  const airbnbFee = Math.round(revenue * 0.15)
  const bookingFee = Math.round(revenue * 0.18)
  const avgOtaFee = Math.round((airbnbFee + bookingFee) / 2)
  const netSaving = avgOtaFee - PLAN_PRICE
  const directPct = Math.min(30, Math.round((netSaving / revenue) * 100))

  return (
    <section className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="text-center mb-10">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Calculadora</div>
          <h2 className="text-3xl font-bold md:text-4xl">Quanto estás a pagar em comissões?</h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Arrasta o slider para a tua receita mensal estimada e vê quanto poupas com reservas diretas.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-8">
          {/* Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Receita mensal de alojamento</label>
              <span className="text-2xl font-bold text-primary">€{revenue.toLocaleString('pt-PT')}</span>
            </div>
            <input
              type="range"
              min={500}
              max={15000}
              step={100}
              value={revenue}
              onChange={e => setRevenue(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
              aria-label="Receita mensal"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>€500</span>
              <span>€15.000</span>
            </div>
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 rounded-xl bg-destructive/5 border border-destructive/20 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive uppercase tracking-wide">
                <TrendingDown className="h-3.5 w-3.5" />
                Airbnb (15%)
              </div>
              <p className="text-2xl font-bold text-destructive">€{airbnbFee.toLocaleString('pt-PT')}</p>
              <p className="text-xs text-muted-foreground">de comissão por mês</p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl bg-destructive/5 border border-destructive/20 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive uppercase tracking-wide">
                <TrendingDown className="h-3.5 w-3.5" />
                Booking.com (18%)
              </div>
              <p className="text-2xl font-bold text-destructive">€{bookingFee.toLocaleString('pt-PT')}</p>
              <p className="text-xs text-muted-foreground">de comissão por mês</p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                <TrendingUp className="h-3.5 w-3.5" />
                Anfitrião (0%)
              </div>
              <p className="text-2xl font-bold text-emerald-600">€{PLAN_PRICE}</p>
              <p className="text-xs text-muted-foreground">custo fixo mensal</p>
            </div>
          </div>

          {/* Savings highlight */}
          {netSaving > 0 && (
            <div className="rounded-xl bg-primary/8 border border-primary/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Com apenas {directPct}% de reservas diretas por mês…
                </p>
                <p className="text-xl font-bold text-primary mt-1">
                  poupas €{netSaving.toLocaleString('pt-PT')}/mês vs. média OTA
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  €{(netSaving * 12).toLocaleString('pt-PT')} por ano a mais para ti.
                </p>
              </div>
              <Link
                href="/sign-up"
                className="shrink-0 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Começar a poupar →
              </Link>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            <Euro className="h-3 w-3 inline mr-0.5" />
            Plano Starter a €{PLAN_PRICE}/mês · 14 dias grátis · sem cartão de crédito
          </p>
        </div>
      </div>
    </section>
  )
}
