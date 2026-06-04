import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAccountByClerkId } from '@/lib/accounts'
import { PLAN_LIMITS } from '@/lib/stripe'
import { UpgradeButton } from './UpgradeButton'
import type { AccountEstado } from '@/lib/accounts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}

const estadoBanner: Record<AccountEstado, { bg: string; text: string; msg: string } | null> = {
  trial:    null,
  activo:   null,
  suspenso: {
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    msg: 'O teu pagamento falhou. Actualiza o método de pagamento para continuar a usar o Anfitrião.',
  },
  cancelado: {
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    msg: 'A tua subscrição foi cancelada. Escolhe um plano abaixo para reactivar.',
  },
}

const PLANOS = [
  {
    key: 'starter' as const,
    nome: 'Starter',
    preco: '19',
    priceIdEnv: 'STRIPE_STARTER_PRICE_ID' as const,
    features: [
      'Até 3 propriedades',
      'AI Concierge ilimitado',
      'Calendário + iCal sync',
      'Check-in online',
      'SEF / SIBA automático',
      'Suporte por email',
    ],
  },
  {
    key: 'pro' as const,
    nome: 'Pro',
    preco: '39',
    priceIdEnv: 'STRIPE_PRO_PRICE_ID' as const,
    destaque: true,
    features: [
      'Até 10 propriedades',
      'Tudo do Starter',
      'Relatórios avançados',
      'Suporte prioritário',
      'Acesso antecipado a novas features',
      'Integração multi-canal',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { success, cancelled } = await searchParams
  const account = await getAccountByClerkId(userId)
  if (!account) redirect('/hoje')

  const daysLeft   = trialDaysLeft(account.trial_ends_at)
  const isTrial    = account.estado === 'trial'
  const isActivo   = account.estado === 'activo'
  const banner     = estadoBanner[account.estado]
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? ''
  const proPriceId     = process.env.STRIPE_PRO_PRICE_ID ?? ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-xl font-bold">Subscrição</h1>
        <p className="text-sm text-muted-foreground mt-1">Gere o teu plano e pagamentos.</p>
      </div>

      {/* Toast de sucesso/cancelamento */}
      {success && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 px-5 py-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">🎉 Subscrição activada com sucesso!</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">Bem-vindo ao Anfitrião {account.plano === 'pro' ? 'Pro' : 'Starter'}.</p>
        </div>
      )}
      {cancelled && (
        <div className="mb-6 rounded-xl bg-muted border border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">Pagamento cancelado. Podes voltar a escolher um plano abaixo.</p>
        </div>
      )}

      {/* Banner de estado (suspenso / cancelado) */}
      {banner && (
        <div className={`mb-6 rounded-xl border px-5 py-4 ${banner.bg}`}>
          <p className={`text-sm font-medium ${banner.text}`}>{banner.msg}</p>
          {account.estado === 'suspenso' && account.stripe_customer_id && (
            <a
              href="/api/stripe/portal"
              className={`inline-block mt-3 text-sm font-semibold underline ${banner.text}`}
            >
              Actualizar método de pagamento →
            </a>
          )}
        </div>
      )}

      {/* Plano actual */}
      <div className="bg-card border border-border rounded-xl p-5 mb-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Plano actual</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold capitalize">
                {account.plano === 'trial' ? 'Trial gratuito' : account.plano === 'starter' ? 'Starter' : 'Pro'}
              </span>
              {isActivo && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Activo
                </span>
              )}
              {isTrial && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Trial
                </span>
              )}
            </div>

            {isTrial && (
              <p className="text-sm text-muted-foreground mt-1">
                {daysLeft > 0
                  ? `${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} restantes no trial`
                  : 'Trial expirado — escolhe um plano para continuar'}
              </p>
            )}

            {isActivo && account.current_period_end && (
              <p className="text-sm text-muted-foreground mt-1">
                Próxima factura: {fmtDate(account.current_period_end)}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              {PLAN_LIMITS[account.plano].propriedades_max} {PLAN_LIMITS[account.plano].propriedades_max === 1 ? 'propriedade' : 'propriedades'} incluídas
            </p>
          </div>

          {/* Barra de trial */}
          {isTrial && account.trial_ends_at && (
            <div className="w-24 shrink-0">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round((daysLeft / 14) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right mt-1">{daysLeft}/14 dias</p>
            </div>
          )}
        </div>

        {/* Botão de gestão para subscritores activos */}
        {isActivo && account.stripe_customer_id && (
          <a
            href="/api/stripe/portal"
            className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
          >
            Gerir subscrição (facturas, cancelar) →
          </a>
        )}
      </div>

      {/* Planos disponíveis */}
      {(isTrial || account.estado === 'cancelado' || account.estado === 'suspenso') && (
        <>
          <p className="text-sm font-semibold mb-4">Escolhe um plano</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLANOS.map(plano => {
              const priceId = plano.key === 'starter' ? starterPriceId : proPriceId
              const isCurrentPlan = account.plano === plano.key && isActivo

              return (
                <div
                  key={plano.key}
                  className={`relative bg-card border rounded-xl p-5 flex flex-col gap-4 ${
                    plano.destaque
                      ? 'border-primary ring-1 ring-primary/30'
                      : 'border-border'
                  }`}
                >
                  {plano.destaque && (
                    <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide">
                      Mais popular
                    </span>
                  )}

                  <div>
                    <p className="font-bold text-base">{plano.nome}</p>
                    <p className="mt-1">
                      <span className="text-2xl font-bold">€{plano.preco}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </p>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {plano.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <svg className="h-4 w-4 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <UpgradeButton
                    priceId={priceId}
                    label={isCurrentPlan ? 'Plano actual' : `Activar ${plano.nome}`}
                    disabled={isCurrentPlan || !priceId}
                    variant={plano.destaque ? 'primary' : 'outline'}
                  />
                </div>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Pagamento seguro via Stripe. Cancela a qualquer momento.
          </p>
        </>
      )}

      {/* Se já está no Pro — mostrar comparação simples */}
      {isActivo && account.plano !== 'trial' && (
        <div className="bg-muted/40 rounded-xl p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Para mudar de plano ou cancelar, usa o portal de cliente acima.
          </p>
        </div>
      )}
    </div>
  )
}
