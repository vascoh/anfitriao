import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, Circle, ArrowRight } from 'lucide-react'
import { getAccountByClerkId } from '@/lib/accounts'
import { adminGetProperties, adminGetWebsiteSettings } from '@/lib/db-admin'
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

export default async function BemVindoPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { plano: planoParam } = await searchParams
  const [account, properties, settings] = await Promise.all([
    getAccountByClerkId(userId),
    adminGetProperties(userId),
    adminGetWebsiteSettings(userId),
  ])

  if (!account) redirect('/hoje')

  const plano = planoParam || account.plano
  const planLabel = PLAN_LABEL[plano] ?? plano
  const firstName = account.nome?.split(' ')[0] ?? 'Anfitrião'

  const hasProperty = properties.length > 0
  const hasIcal = properties.some(p => p.ical_feeds && p.ical_feeds.length > 0)
  const hasEmail = !!(settings?.email)
  const websiteReady = hasEmail && (settings?.enabled ?? false) && !!(settings?.slug)

  const steps = [
    {
      n: '1',
      done: hasProperty,
      title: 'Adiciona a tua primeira propriedade',
      desc: 'Nome, descrição e localização. Leva menos de 2 minutos.',
      cta: hasProperty ? 'Ver propriedades' : 'Adicionar propriedade',
      href: hasProperty ? '/propriedades' : '/propriedades/nova',
    },
    {
      n: '2',
      done: hasIcal,
      title: 'Conecta Airbnb e Booking.com',
      desc: 'Copia o link iCal de cada plataforma para sincronizar reservas automaticamente.',
      cta: 'Configurar sincronização',
      href: '/propriedades',
    },
    {
      n: '3',
      done: websiteReady,
      title: 'Ativa o teu site de reservas diretas',
      desc: 'Personaliza o teu site em anfitrioes.pt/r/[o-teu-nome]. Zero comissões.',
      cta: websiteReady ? 'Ver site' : 'Configurar site',
      href: websiteReady && settings?.slug ? `/r/${settings.slug}` : '/website',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">

        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl"
            aria-hidden="true"
          >
            {allDone ? '✅' : '🎉'}
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {allDone
              ? `Estás pronto, ${firstName}!`
              : `Bem-vindo ao plano ${planLabel}, ${firstName}!`
            }
          </h1>
          <p className="mt-3 text-muted-foreground">
            {allDone
              ? 'A tua conta está completamente configurada.'
              : `${completedCount} de ${steps.length} passos concluídos. Estás quase pronto.`
            }
          </p>
          {!allDone && (
            <div className="mt-4 mx-auto max-w-xs">
              <div className="flex gap-1.5">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${s.done ? 'bg-primary' : 'bg-border'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-10">
          {steps.map(step => (
            <Link
              key={step.n}
              href={step.href}
              className={`flex gap-4 rounded-2xl border bg-card p-5 hover:border-primary/30 transition-colors ${
                step.done ? 'border-border opacity-60' : 'border-border hover:shadow-sm'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                step.done
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              }`}>
                {step.done ? <Check className="h-4 w-4 stroke-[2.5]" /> : step.n}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                  {step.title}
                </h3>
                {!step.done && (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                )}
                {!step.done && (
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    {step.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              {step.done && (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/30 self-center shrink-0" />
              )}
            </Link>
          ))}
        </div>

        {/* Primary CTA */}
        <div className="text-center">
          {!hasProperty ? (
            <Link
              href="/propriedades/nova"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Adicionar primeira propriedade →
            </Link>
          ) : (
            <Link
              href="/hoje"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Ir para o painel →
            </Link>
          )}
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
