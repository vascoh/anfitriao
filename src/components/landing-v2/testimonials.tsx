'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Star, Quote } from 'lucide-react'
import { fadeInUp, VIEWPORT } from '@/lib/landing-animations'

type Testemunho = {
  citacao: string
  nome: string
  cargo: string
  iniciais: string
  estrelas: number
}

/**
 * Depoimentos reais e autorizados. Vazio de propósito: publicar testemunhos
 * inventados num site comercial é prática proibida na UE (Diretiva Omnibus).
 * Enquanto estiver vazio a secção não é renderizada — basta acrescentar
 * entradas verdadeiras para ela voltar ao ar.
 */
const TESTEMUNHOS: Testemunho[] = []

const INTERVALO = 5000

export function Testimonials() {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const reduced = useReducedMotion()

  const ir = useCallback((i: number) => setIndice(i), [])

  useEffect(() => {
    if (pausado || reduced || TESTEMUNHOS.length <= 1) return
    const id = setInterval(
      () => setIndice((i) => (i + 1) % TESTEMUNHOS.length),
      INTERVALO,
    )
    return () => clearInterval(id)
  }, [pausado, reduced])

  const atual = TESTEMUNHOS[indice]

  // Sem depoimentos verdadeiros não há secção — melhor nada do que inventado.
  if (!atual) return null

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Anfitriões que já recuperaram o tempo
          </h2>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          onFocusCapture={() => setPausado(true)}
          onBlurCapture={() => setPausado(false)}
          className="mx-auto mt-12 max-w-3xl"
        >
          <div
            className="relative min-h-64 rounded-xl border border-white/10 bg-slate-900/70 p-8 sm:min-h-56 sm:p-10"
            aria-live="polite"
            aria-atomic="true"
          >
            <Quote className="size-8 text-cyan-400/40" aria-hidden />
            <AnimatePresence mode="wait">
              <motion.figure
                key={indice}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mt-4 flex gap-1" aria-label={`${atual.estrelas} em 5 estrelas`}>
                  {Array.from({ length: atual.estrelas }).map((_, i) => (
                    <Star key={i} className="size-4 fill-cyan-400 text-cyan-400" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-4 text-lg leading-relaxed text-slate-200 sm:text-xl">
                  “{atual.citacao}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-slate-950">
                    {atual.iniciais}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{atual.nome}</span>
                    <span className="block text-xs text-slate-400">{atual.cargo}</span>
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            {TESTEMUNHOS.map((t, i) => (
              <button
                key={t.nome}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver testemunho de ${t.nome}`}
                aria-current={i === indice}
                className={`h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 ${
                  i === indice ? 'w-8 bg-cyan-400' : 'w-4 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
