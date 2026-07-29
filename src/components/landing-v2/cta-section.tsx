'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { fadeInUp, VIEWPORT } from '@/lib/landing-animations'

export function CTASection() {
  const reduced = useReducedMotion()

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-cyan-600 px-6 py-16 text-center sm:px-12 sm:py-20"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(15,23,42,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.35)_1px,transparent_1px)] [background-size:44px_44px]"
          />

          <h2 className="relative text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Pronto para simplificar a gestão?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-slate-900/80">
            14 dias grátis. Sem cartão de crédito. Sem compromisso.
          </p>

          <motion.div
            animate={reduced ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.06 }}
            className="relative mt-10 inline-block"
          >
            <Link
              href="/sign-up"
              className="group inline-flex h-14 items-center gap-2 rounded-xl bg-slate-950 px-9 text-base font-semibold text-white shadow-xl shadow-slate-950/25 transition-shadow hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
            >
              Começar agora
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
