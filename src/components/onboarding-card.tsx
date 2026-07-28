'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, X } from 'lucide-react'
import { progressoOnboarding, type EstadoConta } from '@/lib/onboarding'

const CHAVE_DISPENSADO = 'anf.onboarding.dispensado'
const EVENTO = 'anf:onboarding-dispensado'

function subscrever(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback) // outro separador dispensou
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

function lerDispensado(): boolean {
  return localStorage.getItem(CHAVE_DISPENSADO) === '1'
}

/** No servidor assume dispensado: não renderiza nada e evita flash na hidratação. */
function lerDispensadoNoServidor(): boolean {
  return true
}

/**
 * Cartão de ativação, mostrado no topo de /hoje até a conta estar configurada.
 *
 * Vive no painel diário e não numa página de boas-vindas isolada porque é ali
 * que o anfitrião volta — uma checklist que só existe no primeiro login não
 * ajuda quem parou a meio.
 *
 * Desaparece sozinho quando os passos obrigatórios estão feitos, e pode ser
 * dispensado à mão (guardado em localStorage, por dispositivo).
 */
export function OnboardingCard({ estado }: { estado: EstadoConta }) {
  const dispensado = useSyncExternalStore(subscrever, lerDispensado, lerDispensadoNoServidor)
  const progresso = progressoOnboarding(estado)

  if (dispensado || progresso.completo) return null

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, '1')
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <section className="fade-up rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Configura a tua conta</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {progresso.feitos} de {progresso.total} passos concluídos
          </p>
        </div>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar configuração"
          className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Barra de progresso */}
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-valuenow={progresso.percentagem}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da configuração"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${progresso.percentagem}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1">
        {progresso.passos.map(passo => {
          const proximo = progresso.proximo?.chave === passo.chave
          return (
            <li key={passo.chave}>
              <Link
                href={passo.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  proximo ? 'bg-background shadow-sm' : 'hover:bg-background/60'
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    passo.feito
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border'
                  }`}
                  aria-hidden="true"
                >
                  {passo.feito && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      passo.feito ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {passo.titulo}
                    {passo.opcional && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        opcional
                      </span>
                    )}
                  </span>
                  {proximo && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{passo.descricao}</span>
                  )}
                </span>

                {proximo && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                    {passo.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
