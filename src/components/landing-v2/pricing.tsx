'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { Check } from 'lucide-react'
import { staggerContainer, fadeInUp, VIEWPORT, EASE_OUT } from '@/lib/landing-animations'
import {
  precoMensal,
  limiteDePropriedadesCapitalizado,
  DESCONTO_ANUAL_LABEL,
  TRIAL_DIAS,
  PLAN_LIMITS,
} from '@/lib/planos'

type Plano = {
  nome: string
  preco: (anual: boolean) => string
  sufixo?: string
  resumo: string
  features: string[]
  destaque?: boolean
  cta: string
  href: string
}

const PLANOS: Plano[] = [
  {
    nome: 'Trial',
    preco: () => 'Grátis',
    resumo: `${TRIAL_DIAS} dias, sem cartão de crédito`,
    features: [
      limiteDePropriedadesCapitalizado('trial'),
      'Calendário unificado',
      'Check-in online SIBA',
      'Concierge com IA',
      'Sem cartão de crédito',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
  {
    nome: 'Starter',
    preco: (anual) => `€${precoMensal('starter', anual)}`,
    sufixo: '/mês',
    resumo: limiteDePropriedadesCapitalizado('starter'),
    destaque: true,
    features: [
      limiteDePropriedadesCapitalizado('starter'),
      'Reservas ilimitadas',
      'Concierge com IA ilimitado',
      'Check-in online SIBA',
      'Apoio por email',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
  {
    nome: 'Pro',
    preco: (anual) => `€${precoMensal('pro', anual)}`,
    sufixo: '/mês',
    resumo: limiteDePropriedadesCapitalizado('pro'),
    features: [
      limiteDePropriedadesCapitalizado('pro'),
      'Tudo o do Starter',
      'Relatórios avançados',
      'Apoio prioritário',
      'Acesso antecipado a novidades',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
]

const cardVariants: Variants = {
  ...fadeInUp,
  hover: { scale: 1.04, transition: { duration: 0.25, ease: EASE_OUT } },
}

export function Pricing() {
  const [anual, setAnual] = useState(false)

  return (
    <section id="precos" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold tracking-[0.14em] text-cyan-400 uppercase">
            Preços
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Escolhe o plano à tua medida
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Começas grátis. Sem surpresas e sem comissões sobre as reservas.
          </p>

          <div
            role="group"
            aria-label="Periodicidade do pagamento"
            className="mt-8 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1"
          >
            {[
              { label: 'Mensal', valor: false },
              { label: `Anual ${DESCONTO_ANUAL_LABEL}`, valor: true },
            ].map((opcao) => (
              <button
                key={opcao.label}
                type="button"
                onClick={() => setAnual(opcao.valor)}
                aria-pressed={anual === opcao.valor}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  anual === opcao.valor
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mt-14 grid items-start gap-6 lg:grid-cols-3"
        >
          {PLANOS.map((plano) => (
            <motion.li
              key={plano.nome}
              variants={cardVariants}
              whileHover="hover"
              className={`relative rounded-xl border p-8 transition-colors ${
                plano.destaque
                  ? 'border-cyan-400/60 bg-slate-900 shadow-xl shadow-cyan-500/15 lg:-mt-4 lg:pb-12'
                  : 'border-white/10 bg-slate-900/60 hover:border-cyan-400/50'
              }`}
            >
              {plano.destaque && (
                <motion.span
                  animate={{ opacity: [1, 0.65, 1], scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-slate-950 uppercase"
                >
                  Popular
                </motion.span>
              )}

              <h3 className="text-lg font-semibold text-white">{plano.nome}</h3>
              <p className="mt-1 text-sm text-slate-400">{plano.resumo}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {plano.preco(anual)}
                </span>
                {plano.sufixo && (
                  <span className="text-sm text-slate-400">{plano.sufixo}</span>
                )}
              </p>

              <ul className="mt-7 space-y-3.5">
                {plano.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${plano.destaque ? 'text-cyan-400' : 'text-emerald-400'}`}
                      aria-hidden
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plano.href}
                className={`mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 ${
                  plano.destaque
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/50'
                    : 'border border-white/20 text-white hover:border-cyan-400/60 hover:bg-cyan-500/10'
                }`}
              >
                {plano.cta}
              </Link>
            </motion.li>
          ))}
        </motion.ul>

        <motion.p
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mt-10 text-center text-sm text-slate-400"
        >
          Todos os planos incluem {TRIAL_DIAS} dias de teste. Mais de{' '}
          {PLAN_LIMITS.pro.propriedades_max} propriedades?{' '}
          <a
            href="mailto:suporte@anfitrioes.pt"
            className="font-semibold text-cyan-400 underline-offset-4 hover:underline"
          >
            Fala connosco
          </a>{' '}
          sobre um plano Enterprise.
        </motion.p>
      </div>
    </section>
  )
}
