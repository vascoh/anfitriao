'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { AccountPlano } from '@/lib/accounts'
import {
  PLAN_LIMITS,
  PLAN_NOME,
  PLAN_PRICE_EUR,
  limiteDeUnidades,
  proximoPlano,
} from '@/lib/planos'

export interface EstadoLimite {
  plano: AccountPlano
  max: number
  usadas: number
}

/** Está no teto: mais uma unidade alugável já não cabe. */
export function noLimite(e: EstadoLimite | null): boolean {
  return !!e && e.usadas >= e.max
}

/**
 * O convite para mudar de plano, no sítio onde o limite se sente.
 *
 * Antes, quem enchia o plano só sabia no fim: preenchia o formulário todo e
 * recebia um erro em toast que desaparecia em seis segundos. Agora o ecrã diz
 * logo à entrada quanto está usado, que plano resolve e quanto custa, com um
 * botão que leva direto a esse cartão na página de subscrição.
 *
 * Quem cria o primeiro quarto de uma casa não gasta unidade (a casa deixa de
 * contar), por isso o aviso não bloqueia o formulário: informa.
 */
export function AvisoLimitePlano({ estado }: { estado: EstadoLimite }) {
  const proximo = proximoPlano(estado.plano, estado.usadas + 1)

  return (
    <section
      aria-labelledby="aviso-limite-titulo"
      className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="aviso-limite-titulo" className="text-sm font-semibold text-foreground">
            Usaste {estado.usadas} de {estado.max} no plano {estado.plano === 'trial' ? 'experimental' : PLAN_NOME[estado.plano]}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {proximo ? (
              <>
                Um alojamento novo precisa do <strong className="font-semibold text-foreground">{PLAN_NOME[proximo]}</strong>:{' '}
                {limiteDeUnidades(proximo)} por <span className="tabular">{PLAN_PRICE_EUR[proximo]} €</span>/mês.
                {' '}Um primeiro quarto dentro de uma casa que já tens não conta.
              </>
            ) : (
              <>
                Mais de {PLAN_LIMITS.empresa.propriedades_max} quartos? Escreve-nos e montamos um plano à medida.
              </>
            )}
          </p>

          {proximo ? (
            <Link
              href={`/conta/billing#plano-${proximo}`}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80"
            >
              Passar para o {PLAN_NOME[proximo]}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <a
              href="mailto:suporte@anfitrioes.pt?subject=Plano%20%C3%A0%20medida"
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80"
            >
              Falar connosco
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
