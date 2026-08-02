'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { Calendar, ShieldCheck, Building2 } from 'lucide-react'
import { fadeInUp, scaleIn, VIEWPORT } from '@/lib/landing-animations'

const PROPRIEDADES = [
  { nome: 'Apartamento Baixa', ocupacao: 92, estado: 'Ocupado' },
  { nome: 'Casa da Praia', ocupacao: 78, estado: 'Livre' },
  { nome: 'Loft Ribeira', ocupacao: 85, estado: 'Check-in hoje' },
]

/**
 * O painel ilustrado tem de mostrar apenas ecrãs que existem. A versão
 * anterior desta secção mostrava uma caixa de entrada com mensagens do Airbnb
 * e do Booking — funcionalidade que o produto não tem. Foi substituída pela
 * conformidade, que existe (`/conformidade`, `/documentos`).
 */
const CONFORMIDADE = [
  { titulo: 'Boletins do SIBA', detalhe: '2 prontos a entregar', estado: 'aviso' as const },
  { titulo: 'Taxa turística · julho', detalhe: 'Mapa calculado', estado: 'ok' as const },
  { titulo: 'Seguro de responsabilidade civil', detalhe: 'Válido até 14/03/2027', estado: 'ok' as const },
]

export function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['6%', '-6%'])
  const glowY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <section ref={ref} className="relative overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-cyan-500/15 blur-[100px]"
      />

      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Tudo o que precisas num único lugar
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Calendário, obrigações legais e alojamentos no mesmo ecrã. O que tens
            de fazer hoje aparece primeiro.
          </p>
        </motion.div>

        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          style={{ y }}
          className="mt-14 overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/10"
        >
          {/* Barra da janela */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950/60 px-5 py-3">
            <span className="size-2.5 rounded-full bg-red-400/60" />
            <span className="size-2.5 rounded-full bg-amber-400/60" />
            <span className="size-2.5 rounded-full bg-emerald-400/60" />
            <span className="ml-4 text-xs text-slate-400">anfitrioes.pt / painel</span>
          </div>

          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-3">
            {/* Calendário */}
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-5 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-cyan-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Calendário unificado</h3>
                <span className="ml-auto text-xs text-slate-400">Julho</span>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => {
                  const airbnb = [4, 5, 6, 12, 13, 24, 25, 26].includes(i)
                  const booking = [9, 10, 18, 19, 20, 30].includes(i)
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.25, delay: i * 0.012 }}
                      className={`aspect-square rounded-md ${
                        airbnb
                          ? 'bg-cyan-500/70'
                          : booking
                            ? 'bg-emerald-500/70'
                            : 'bg-white/5'
                      }`}
                    />
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-cyan-500/70" /> Airbnb
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-emerald-500/70" /> Booking
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-white/10" /> Livre
                </span>
              </div>
            </div>

            {/* Conformidade */}
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-cyan-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Conformidade</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {CONFORMIDADE.map((c) => (
                  <li key={c.titulo} className="rounded-lg bg-white/[0.04] p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          c.estado === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span className="text-xs font-medium text-white">{c.titulo}</span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-slate-400">{c.detalhe}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Propriedades */}
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-5 lg:col-span-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-cyan-400" aria-hidden />
                <h3 className="text-sm font-semibold text-white">Alojamentos</h3>
                {/* Sem métrica de resultado: um "+12% ocupação" sem cliente que
                    o sustente é uma alegação comercial não comprovável
                    (Diretiva Omnibus), não um detalhe decorativo. */}
                <span className="ml-auto text-xs text-slate-400">3 alojamentos</span>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {PROPRIEDADES.map((p) => (
                  <li key={p.nome} className="rounded-lg bg-white/[0.04] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-white">{p.nome}</span>
                      <span className="text-xs text-slate-400">{p.ocupacao}%</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${p.ocupacao}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">{p.estado}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Ilustração do painel com dados de exemplo.
        </p>
      </div>
    </section>
  )
}
