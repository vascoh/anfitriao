'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  compararCusto,
  PRECO_POR_UNIDADE_OMISSAO,
  MAX_UNIDADES,
  MAX_PRECO_UNIDADE,
} from '@/lib/comparador-precos'
import { PLAN_NOME } from '@/lib/planos'
import { ANTETITULO, BOTAO_PRIMARIO, CONTENTOR, FAIXA, FOCO, LEAD, SECCAO, TITULO_SECCAO } from './estilos'

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
    <section id="calculadora" className={`${SECCAO} ${FAIXA} scroll-mt-16`}>
      <div className={CONTENTOR}>
        <div className="reveal mx-auto max-w-3xl">
          <div className="text-center">
            <p className={ANTETITULO}>
              Faz as contas
            </p>
            <h2 className={`mt-3 ${TITULO_SECCAO}`}>
              Pagas por alojamento. Aqui pagas por conta.
            </h2>
            <p className={`mt-4 ${LEAD}`}>
              Escreve o que pagas hoje. A conta é feita com os nossos preços reais,
              os mesmos que estão aqui em baixo.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-background p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor={idUnidades} className="block text-sm font-semibold text-foreground">
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
                    className={`h-2 w-full cursor-pointer accent-primary ${FOCO}`}
                  />
                  <output
                    htmlFor={idUnidades}
                    className="w-12 shrink-0 text-right text-lg font-semibold tabular-nums text-foreground"
                  >
                    {r.unidades}
                  </output>
                </div>
              </div>

              <div>
                <label htmlFor={idPreco} className="block text-sm font-semibold text-foreground">
                  O que pagas hoje, por alojamento/mês
                </label>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-muted-foreground" aria-hidden="true">€</span>
                  <input
                    id={idPreco}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={MAX_PRECO_UNIDADE}
                    step={1}
                    value={precoUnidade}
                    onChange={(e) => setPrecoUnidade(Number(e.target.value))}
                    className={`h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground tabular-nums ${FOCO}`}
                  />
                  <button
                    type="button"
                    onClick={() => setAnual(!anual)}
                    aria-pressed={anual}
                    className={`h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold transition-colors ${FOCO} ${
                      anual
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>
            </div>

            <div
              aria-live="polite"
              className="mt-8 grid gap-4 border-t border-border pt-8 sm:grid-cols-3"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Por alojamento
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">
                  {eur.format(r.custoPorUnidade)}<span className="text-base font-medium text-muted-foreground">/mês</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  No Anfitrião
                </p>
                {r.custoAnfitriao === null ? (
                  <p className="mt-1 text-lg font-semibold text-foreground">Falamos contigo</p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {eur.format(r.custoAnfitriao)}<span className="text-base font-medium text-muted-foreground">/mês</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Plano {PLAN_NOME[r.plano!]} · {eurExato.format(r.precoEfetivoPorUnidade!)} por alojamento
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Diferença por ano
                </p>
                {r.custoAnfitriao === null ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Acima de {MAX_UNIDADES} unidades o preço é falado caso a caso.
                  </p>
                ) : r.naoCompensa ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Com estes números não poupas. A vantagem de pagar por conta
                    cresce com o número de alojamentos. Experimenta subir o
                    cursor.
                  </p>
                ) : (
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                    {eur.format(r.poupancaAno)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                O valor da esquerda és tu que o escreves. Não publicamos preços
                de outras ferramentas, que mudam sem nos dizerem.
              </p>
              <Link
                href="/sign-up"
                className={`${BOTAO_PRIMARIO} h-11 shrink-0 px-5 text-sm`}
              >
                Experimentar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
