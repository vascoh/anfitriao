'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { staggerContainer, fadeInUp, VIEWPORT, EASE_OUT } from '@/lib/landing-animations'
import { PERGUNTAS } from './faq-data'

export function FAQ() {
  const [aberto, setAberto] = useState<number | null>(0)

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Perguntas frequentes
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mt-12 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60"
        >
          {PERGUNTAS.map((item, i) => {
            const expandido = aberto === i
            return (
              <motion.div key={item.pergunta} variants={fadeInUp}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : i)}
                    aria-expanded={expandido}
                    aria-controls={`faq-painel-${i}`}
                    id={`faq-botao-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    <span className="text-base font-medium text-white">{item.pergunta}</span>
                    <motion.span
                      animate={{ rotate: expandido ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="shrink-0"
                    >
                      <ChevronDown
                        className={`size-5 ${expandido ? 'text-cyan-400' : 'text-slate-400'}`}
                        aria-hidden
                      />
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expandido && (
                    <motion.div
                      id={`faq-painel-${i}`}
                      role="region"
                      aria-labelledby={`faq-botao-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm leading-relaxed text-slate-400">
                        {item.resposta}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
