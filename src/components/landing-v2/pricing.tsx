'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  precoMensal,
  precoPorUnidade,
  limiteDeUnidadesCapitalizado,
  DESCONTO_ANUAL_LABEL,
  TRIAL_DIAS,
  PLAN_LIMITS,
} from '@/lib/planos'
import { IA_ATIVA } from '@/lib/ia'
import { ANTETITULO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTENTOR, FOCO, LEAD, SECCAO, TITULO_SECCAO } from './estilos'

type Plano = {
  nome: string
  preco: (anual: boolean) => string
  sufixo?: string
  resumo: string
  features: string[]
  destaque?: boolean
  cta: string
  href: string
}

const PLANOS: Plano[] = [
  {
    nome: 'Trial',
    preco: () => 'Grátis',
    resumo: `${TRIAL_DIAS} dias, sem cartão de crédito`,
    features: [
      limiteDeUnidadesCapitalizado('trial'),
      'Calendário unificado',
      'Check-in online SIBA',
      ...(IA_ATIVA ? ['Concierge com IA'] : []),
      'Sem cartão de crédito',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
  {
    nome: 'Starter',
    preco: (anual) => `${precoMensal('starter', anual)} €`,
    sufixo: '/mês',
    resumo: limiteDeUnidadesCapitalizado('starter'),
    destaque: true,
    features: [
      limiteDeUnidadesCapitalizado('starter'),
      'Reservas ilimitadas',
      ...(IA_ATIVA ? ['Concierge com IA ilimitado'] : []),
      'Check-in online SIBA',
      'Apoio por email',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
  {
    nome: 'Pro',
    preco: (anual) => `${precoMensal('pro', anual)} €`,
    sufixo: '/mês',
    resumo: limiteDeUnidadesCapitalizado('pro'),
    features: [
      limiteDeUnidadesCapitalizado('pro'),
      'Tudo o do Starter',
      'Relatórios e RevPAR por alojamento',
      'Site de reservas diretas',
      'Apoio prioritário',
    ],
    cta: 'Começar',
    href: '/sign-up',
  },
  {
    nome: 'Empresa',
    preco: (anual) => `${precoMensal('empresa', anual)} €`,
    sufixo: '/mês',
    resumo: 'Guest houses, hostels e hotéis',
    features: [
      limiteDeUnidadesCapitalizado('empresa'),
      `Menos de ${precoPorUnidade('empresa').toFixed(2).replace('.', ',')} € por quarto`,
      'Tudo o do Pro',
      'Boletins do SIBA por estabelecimento',
      'Migração assistida',
    ],
    cta: 'Falar connosco',
    href: 'mailto:suporte@anfitrioes.pt?subject=Plano%20Empresa',
  },
]

export function Pricing() {
  const [anual, setAnual] = useState(false)

  return (
    <section id="precos" className={`${SECCAO} scroll-mt-16`}>
      <div className={CONTENTOR}>
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className={ANTETITULO}>Preços</p>
          <h2 className={`mt-3 ${TITULO_SECCAO}`}>Escolhe o plano à tua medida</h2>
          <p className={`mt-4 ${LEAD}`}>
            Começas grátis. Sem surpresas e sem comissões sobre as reservas.
          </p>

          <div
            role="group"
            aria-label="Periodicidade do pagamento"
            className="mt-8 inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1"
          >
            {[
              { label: 'Mensal', valor: false },
              { label: `Anual ${DESCONTO_ANUAL_LABEL}`, valor: true },
            ].map((opcao) => (
              <button
                key={opcao.label}
                type="button"
                onClick={() => setAnual(opcao.valor)}
                aria-pressed={anual === opcao.valor}
                className={`h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${FOCO} ${
                  anual === opcao.valor
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-12 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANOS.map((plano) => (
            <li
              key={plano.nome}
              className={`reveal relative flex flex-col rounded-2xl border p-7 ${
                plano.destaque
                  ? 'border-primary bg-background shadow-[0_24px_60px_-30px_color-mix(in_oklch,var(--primary)_60%,transparent)]'
                  : 'border-border bg-card'
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Recomendado
                </span>
              )}

              <h3 className="text-lg font-semibold text-foreground">{plano.nome}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plano.resumo}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="tabular text-4xl font-semibold tracking-tight text-foreground">
                  {plano.preco(anual)}
                </span>
                {plano.sufixo && (
                  <span className="text-sm text-muted-foreground">{plano.sufixo}</span>
                )}
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {plano.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plano.href}
                className={`${plano.destaque ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} mt-8 h-12 w-full text-sm`}
              >
                {plano.cta}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todos os planos incluem {TRIAL_DIAS} dias de teste. Mais de{' '}
          {PLAN_LIMITS.empresa.propriedades_max} quartos?{' '}
          <a
            href="mailto:suporte@anfitrioes.pt"
            className={`rounded-sm font-semibold text-primary underline underline-offset-4 ${FOCO}`}
          >
            Fala connosco
          </a>{' '}
          sobre um plano à medida.
        </p>
      </div>
    </section>
  )
}
