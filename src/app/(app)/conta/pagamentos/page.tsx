import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import { getAccountByClerkId } from '@/lib/accounts'
import { ConnectButton } from './ConnectButton'

export default async function PagamentosPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const account = await getAccountByClerkId(userId)
  if (!account) redirect('/sign-in')

  const status: 'nao_ligado' | 'pendente' | 'ativo' = !account.stripe_connect_account_id
    ? 'nao_ligado'
    : account.stripe_connect_charges_enabled
    ? 'ativo'
    : 'pendente'

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
      </header>

      <div className="max-w-xl flex flex-col gap-6 p-4">
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Recebe pagamentos com cartão diretamente
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Liga a tua conta Stripe para os hóspedes poderem pagar a reserva com cartão de crédito no momento
            de reservar. O dinheiro vai <strong className="text-foreground">diretamente para a tua conta</strong> —
            a Anfitrião nunca o recebe nem guarda, e não cobra comissão sobre reservas diretas.
          </p>

          {status === 'ativo' && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Pagamentos ativos</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  Os hóspedes já podem pagar a reserva com cartão no teu site.
                </p>
              </div>
            </div>
          )}

          {status === 'pendente' && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Falta completar o registo</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  A Stripe ainda precisa de alguns dados (identificação/conta bancária) para ativar os pagamentos.
                </p>
              </div>
            </div>
          )}

          {status === 'nao_ligado' && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Ainda não ligaste uma conta Stripe. Enquanto isso, os hóspedes só podem pedir reserva
                (confirmas e combinas o pagamento diretamente com eles).
              </p>
            </div>
          )}

          <ConnectButton label={
            status === 'nao_ligado' ? 'Ligar Stripe' :
            status === 'pendente' ? 'Continuar registo na Stripe' :
            'Gerir conta Stripe'
          } />

          {status !== 'nao_ligado' && (
            <p className="text-[11px] text-muted-foreground text-center">
              Precisas de atualizar dados bancários ou de identificação? O mesmo botão abre a Stripe outra vez.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
