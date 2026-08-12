'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { fadeInUp, VIEWPORT } from '@/lib/landing-animations'
import {
  compararCusto,
  PRECO_POR_UNIDADE_OMISSAO,
  MAX_UNIDADES,
  MAX_PRECO_UNIDADE,
} from '@/lib/comparador-precos'
import { PLAN_NOME } from '@/lib/planos'

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const eurExato = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

/**
 * Calculadora "por alojamento vs. por conta".
 *
 * Fica **antes** dos preços: a tabela responde "quanto custa", e esta responde
 * "quanto custa comparado com o que já pagas", que é a pergunta que a pessoa
 * traz. O número da concorrência é escrito por quem visita — ver o porquê em
 * `lib/comparador-precos.ts`.
 */
export function Calculadora() {
  const idUnidades = useId()
  const idPreco = useId()

  const [unidades, setUnidades] = useState(4)
  const [precoUnidade, setPrecoUnidade] = useState(PRECO_POR_UNIDADE_OMISSAO)
  const [anual, setAnual] = useState(false)

  const r = useMemo(
    () => compararCusto({ unidades, precoPorUnidade: precoUnidade, anual }),
    [unidades, precoUnidade, anual],
  )

  return (
    <section id="calculadora" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          className="mx-auto max-w-3xl"
        >
          <div className="text-center">
            <p className="text-sm font-semibold tracking-[0.14em] text-cyan-400 uppercase">
              Faz as contas
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Pagas por alojamento. Aqui pagas por conta.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Escreve o que pagas hoje. A conta é feita com os nossos preços reais,
              os mesmos que estão aqui em baixo.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor={idUnidades} className="block text-sm font-semibold text-white">
                  Quartos ou alojamentos
                </label>
                <div className="mt-3 flex items-center gap-4">
                  <input
                    id={idUnidades}
                    type="range"
                    min={1}
                    max={MAX_UNIDADES}
                    step={1}
                    value={unidades}
                    onChange={(e) => setUnidades(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  />
                  <output
                    htmlFor={idUnidades}
                    className="w-12 shrink-0 text-right text-lg font-bold tabular-nums text-white"
                  >
                    {r.unidades}
                  </output>
                </div>
              </div>

              <div>
                <label htmlFor={idPreco} className="block text-sm font-semibold text-white">
                  O que pagas hoje, por alojamento/mês
                </label>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-slate-400" aria-hidden="true">€</span>
                  <input
                    id={idPreco}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={MAX_PRECO_UNIDADE}
                    step={1}
                    value={precoUnidade}
                    onChange={(e) => setPrecoUnidade(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-white tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setAnual(!anual)}
                    aria-pressed={anual}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                      anual
                        ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300'
                        : 'border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>
            </div>

            <div
              aria-live="polite"
              className="mt-8 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Por alojamento
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-300">
                  {eur.format(r.custoPorUnidade)}<span className="text-base font-medium text-slate-400">/mês</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  No Anfitrião
                </p>
                {r.custoAnfitriao === null ? (
                  <p className="mt-1 text-lg font-semibold text-white">Falamos contigo</p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                      {eur.format(r.custoAnfitriao)}<span className="text-base font-medium text-slate-400">/mês</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Plano {PLAN_NOME[r.plano!]} · {eurExato.format(r.precoEfetivoPorUnidade!)} por alojamento
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Diferença por ano
                </p>
                {r.custoAnfitriao === null ? (
                  <p className="mt-1 text-sm text-slate-400">
                    Acima de {MAX_UNIDADES} unidades o preço é falado caso a caso.
                  </p>
                ) : r.naoCompensa ? (
                  <p className="mt-1 text-sm text-slate-400">
                    Com estes números não poupas. A vantagem de pagar por conta
                    cresce com o número de alojamentos — experimenta subir o
                    cursor.
                  </p>
                ) : (
                  <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-400">
                    {eur.format(r.poupancaAno)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                O valor da esquerda és tu que o escreves — não publicamos preços
                de outras ferramentas, que mudam sem nos dizerem.
              </p>
              <Link
                href="/sign-up"
                className="shrink-0 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                Experimentar
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
