'use client'

import { motion } from 'motion/react'
import { Calendar, ShieldCheck, FileText, TrendingUp, type LucideIcon } from 'lucide-react'
import type { Variants } from 'motion/react'
import { staggerContainer, fadeInUp, VIEWPORT, EASE_OUT } from '@/lib/landing-animations'

/** Hover do cartão propaga para o ícone via variantes com o mesmo nome. */
const cardVariants: Variants = {
  ...fadeInUp,
  hover: { scale: 1.05, transition: { duration: 0.25, ease: EASE_OUT } },
}

const iconVariants: Variants = {
  hover: { rotate: 360, transition: { duration: 0.7, ease: EASE_OUT } },
}

type Feature = {
  icon: LucideIcon
  titulo: string
  descricao: string
}

/**
 * Regra desta lista: **só entra o que já está no produto hoje**.
 *
 * Uma funcionalidade prometida aqui e ausente lá dentro custa mais do que
 * ganha — converte pior (quem conhece o mercado deteta) e churna muito pior
 * (quem assina descobre). Se for preciso escrever "em breve", não entra.
 */
const FEATURES: Feature[] = [
  {
    icon: Calendar,
    titulo: 'Calendário unificado',
    descricao: 'Airbnb, Booking e Vrbo no mesmo calendário, sincronizados todos os dias — ou à mão, quando não podes esperar.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Conformidade portuguesa',
    descricao: 'Boletins do SIBA prontos a entregar, taxa turística calculada por concelho, mapa do INE e alertas de seguro e RNAL.',
  },
  {
    icon: FileText,
    titulo: 'Check-in online',
    descricao: 'O hóspede preenche os dados e fotografa o documento antes de chegar. Chega com o boletim já feito.',
  },
  {
    icon: TrendingUp,
    titulo: 'Receita e despesas',
    descricao: 'Ocupação, RevPAR, comissões retidas pelas plataformas e lucro líquido por alojamento.',
  },
]

export function Features() {
  return (
    <section id="funcionalidades" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold tracking-[0.14em] text-cyan-400 uppercase">
            Funcionalidades
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            O essencial, sem a papelada
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Quatro ferramentas que substituem meia dúzia de separadores abertos.
          </p>
        </motion.div>

        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, titulo, descricao }) => (
            <motion.li
              key={titulo}
              variants={cardVariants}
              whileHover="hover"
              className="group rounded-xl border border-white/10 bg-slate-900/70 p-7 transition-colors hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/10"
            >
              <motion.span
                variants={iconVariants}
                className="grid size-12 place-items-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/25"
              >
                <Icon className="size-6 text-cyan-400" aria-hidden />
              </motion.span>
              <h3 className="mt-6 text-lg font-semibold text-white">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{descricao}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
