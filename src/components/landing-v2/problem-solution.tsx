'use client'

import { motion } from 'motion/react'
import { CircleDashed, CircleCheckBig, X, Check } from 'lucide-react'
import { staggerContainer, fadeInUp, VIEWPORT } from '@/lib/landing-animations'

const PROBLEMA = [
  'Várias plataformas (Airbnb, Booking, etc.)',
  'Sem visão unificada',
  'Demasiado tempo em tarefas administrativas',
]

const SOLUCAO = [
  'Um painel inteligente',
  'Calendários sincronizados',
  'Mais tempo para os hóspedes',
]

export function ProblemSolution() {
  return (
    <section id="plataforma" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="grid gap-6 lg:grid-cols-2 lg:gap-8"
        >
          {/* Problema */}
          <motion.div
            variants={fadeInUp}
            className="rounded-xl border border-red-500/20 bg-slate-900/60 p-8 sm:p-10"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-red-500/10 ring-1 ring-red-500/25">
              <CircleDashed className="size-6 text-red-400" aria-hidden />
            </span>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Gestão fragmentada
            </h2>
            <ul className="mt-6 space-y-4">
              {PROBLEMA.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-400">
                  <X className="mt-0.5 size-5 shrink-0 text-red-400/80" aria-hidden />
                  <span className="text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Solução */}
          <motion.div
            variants={fadeInUp}
            className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-slate-900/60 p-8 sm:p-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-emerald-500/10 blur-3xl"
            />
            <span className="grid size-12 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
              <CircleCheckBig className="size-6 text-emerald-400" aria-hidden />
            </span>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Controlo total
            </h2>
            <ul className="mt-6 space-y-4">
              {SOLUCAO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-200">
                  <Check className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden />
                  <span className="text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
