'use client'

import { motion } from 'motion/react'
import { Calendar, MessageSquare, FileText, TrendingUp, type LucideIcon } from 'lucide-react'
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

const FEATURES: Feature[] = [
  {
    icon: Calendar,
    titulo: 'Calendário unificado',
    descricao: 'Sincroniza Airbnb, Booking e Vrbo, com atualização contínua.',
  },
  {
    icon: MessageSquare,
    titulo: 'Mensagens centralizadas',
    descricao: 'Todas as conversas numa única caixa de entrada.',
  },
  {
    icon: FileText,
    titulo: 'Documentos e check-in',
    descricao: 'Check-in digital, contrato eletrónico e fotografias.',
  },
  {
    icon: TrendingUp,
    titulo: 'Análise e finanças',
    descricao: 'Ocupação, receita e retorno por propriedade.',
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
