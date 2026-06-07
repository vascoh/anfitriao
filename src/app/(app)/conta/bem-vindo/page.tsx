import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAccountByClerkId } from '@/lib/accounts'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bem-vindo ao Anfitrião',
  robots: { index: false, follow: false },
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro:     'Pro',
  trial:   'Trial',
}

const steps = [
  {
    n: '1',
    title: 'Adiciona a tua primeira propriedade',
    desc: 'Nome, descrição e foto. Leva menos de 2 minutos.',
    cta: 'Adicionar propriedade',
    href: '/propriedades/nova',
  },
  {
    n: '2',
    title: 'Conecta Airbnb e Booking.com',
    desc: 'Copia o link iCal de cada plataforma para sincronizar reservas automaticamente.',
    cta: 'Ver as minhas propriedades',
    href: '/propriedades',
  },
  {
    n: '3',
    title: 'Partilha o teu site de reservas diretas',
    desc: 'Cada propriedade tem um site próprio em anfitrioes.pt/r/[o-teu-nome]. Zero comissões.',
    cta: 'Personalizar site',
    href: '/website',
  },
]

export default async function BemVindoPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { plano: planoParam } = await searchParams
  const account = await getAccountByClerkId(userId)
  if (!account) redirect('/hoje')

  const plano = planoParam || account.plano
  const planLabel = PLAN_LABEL[plano] ?? plano
  const firstName = account.nome?.split(' ')[0] ?? 'Anfitrião'

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">

        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl"
            aria-hidden="true"
          >
            🎉
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">
            Bem-vindo ao plano {planLabel}, {firstName}!
          </h1>
          <p className="mt-3 text-muted-foreground">
            A tua conta está activa. Aqui está como tirar o máximo partido do Anfitrião:
          </p>
        </div>

        {/* Onboarding steps */}
        <div className="space-y-4 mb-10">
          {steps.map(step => (
            <div
              key={step.n}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {step.n}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{step.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                <Link
                  href={step.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {step.cta}
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <div className="text-center">
          <Link
            href="/propriedades/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            Adicionar primeira propriedade →
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Ou{' '}
            <Link href="/hoje" className="font-medium text-primary hover:underline">
              vai para o painel
            </Link>{' '}
            e explora à tua vontade.
          </p>
        </div>

        {/* Help */}
        <div className="mt-10 rounded-xl bg-muted/40 px-5 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Alguma dúvida?{' '}
            <a href="mailto:suporte@anfitrioes.pt" className="font-medium text-primary hover:underline">
              suporte@anfitrioes.pt
            </a>
            {' '}— respondemos em menos de 24h.
          </p>
        </div>

      </div>
    </div>
  )
}
