'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { Sparkles, ArrowRight, PlayCircle } from 'lucide-react'
import { wordContainer, wordReveal, slideUp, EASE_OUT } from '@/lib/landing-animations'
import { TRIAL_DIAS } from '@/lib/planos'
import { HeroVisual } from './hero-visual'

const TITULO = ['Centraliza', 'tudo.', 'Hospeda', 'melhor.']

export function Hero() {
  const reduced = useReducedMotion()

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Gradiente ciano → escuro + padrão subtil */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(6,182,212,0.28),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_20%,rgba(16,185,129,0.14),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="inline-block"
          >
            <motion.span
              animate={reduced ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Para anfitriões locais
            </motion.span>
          </motion.div>

          <motion.h1
            variants={wordContainer}
            initial="hidden"
            animate="visible"
            className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            {/* O espaço tem de ser um nó de texto entre os spans, não uma margem:
                com margem o H1 fica visualmente certo mas o textContent é
                "Centralizatudo.Hospedamelhor." para o Google e para os leitores
                de ecrã. Dentro do inline-block seria descartado, por isso vai
                fora dele. */}
            {TITULO.map((palavra, i) => (
              <Fragment key={palavra}>
                <span className="inline-block overflow-hidden align-bottom">
                  <motion.span
                    variants={wordReveal}
                    className={`inline-block ${i >= 2 ? 'text-cyan-400' : ''}`}
                  >
                    {palavra}
                  </motion.span>
                </span>
                {i < TITULO.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </motion.h1>

          <motion.p
            variants={slideUp}
            initial="hidden"
            animate="visible"
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl"
          >
            Os alojamentos, as reservas e os hóspedes num só lugar — com o
            check-in online feito e as obrigações legais portuguesas tratadas
            no mesmo sítio.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: EASE_OUT }}
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/sign-up"
                className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-7 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition-shadow hover:shadow-xl hover:shadow-cyan-500/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 sm:w-auto"
              >
                Teste grátis ({TRIAL_DIAS} dias)
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="#plataforma"
                className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 sm:w-auto"
              >
                <PlayCircle className="size-4" aria-hidden />
                Ver demonstração
              </Link>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-5 text-sm text-slate-400"
          >
            Sem cartão de crédito. Cancelas quando quiseres.
          </motion.p>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}
