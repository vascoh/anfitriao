'use client'

import { useState } from 'react'
import Link from 'next/link'

const plans = {
  starter: { monthly: 19, annual: 15 },
  pro: { monthly: 39, annual: 32 },
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="precos" className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-12">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Preços</div>
          <h2 className="text-3xl font-bold md:text-4xl">Simples e transparente</h2>
          <p className="mt-4 text-muted-foreground">Começa grátis. Sem surpresas, sem comissões sobre reservas.</p>
        </div>

        {/* Toggle Mensal / Anual */}
        <div className="mb-12 flex items-center justify-center gap-3">
          <div
            className="inline-flex items-center rounded-full border border-border bg-card p-1"
            role="group"
            aria-label="Período de faturação"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors ${
                !annual
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors ${
                annual
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
            </button>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              annual
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400'
                : 'bg-muted text-foreground/70'
            }`}
          >
            Poupa 2 meses
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">

          {/* Trial */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold text-muted-foreground mb-4">Trial</div>
            <div className="text-4xl font-bold mb-1">Grátis</div>
            <div className="text-sm text-muted-foreground mb-6">14 dias · Sem cartão</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8" role="list">
              {['1 propriedade', 'Todas as funcionalidades', 'Sync Airbnb/Booking', 'Check-in online'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:bg-muted transition-colors"
            >
              Começar trial
            </Link>
          </div>

          {/* Starter — destacado */}
          <div className="rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/5 to-card p-6 relative shadow-lg shadow-primary/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground whitespace-nowrap">
              Mais popular
            </div>
            <div className="text-sm font-semibold text-primary mb-4">Starter</div>
            <div className="text-4xl font-bold mb-1">
              €{annual ? plans.starter.annual : plans.starter.monthly}
              <span className="text-lg font-normal text-muted-foreground">/mês</span>
            </div>
            <div className="text-sm text-muted-foreground mb-6">
              {annual ? 'Faturado anualmente' : 'Faturado mensalmente'}
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8" role="list">
              {['Até 3 propriedades', 'Reservas ilimitadas', 'AI Concierge ilimitado', 'Check-in online SIBA', 'Suporte por email'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block w-full rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Começar agora
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold text-muted-foreground mb-4">Pro</div>
            <div className="text-4xl font-bold mb-1">
              €{annual ? plans.pro.annual : plans.pro.monthly}
              <span className="text-lg font-normal text-muted-foreground">/mês</span>
            </div>
            <div className="text-sm text-muted-foreground mb-6">
              {annual ? 'Faturado anualmente' : 'Faturado mensalmente'}
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8" role="list">
              {['Até 10 propriedades', 'Tudo do Starter', 'Relatórios avançados', 'Suporte prioritário', 'Acesso antecipado a novas features'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:bg-muted transition-colors"
            >
              Começar trial
            </Link>
          </div>
        </div>

        {/* Reassurance line */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Todos os planos incluem trial de 14 dias ·{' '}
          <strong className="text-foreground font-medium">Sem comissões sobre reservas</strong>{' '}
          · Cancela quando quiseres
        </p>
      </div>
    </section>
  )
}
