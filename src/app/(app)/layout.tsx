import { Toaster } from 'sonner'
import { SideNav } from '@/components/side-nav'
import { BottomNav } from '@/components/bottom-nav'
import { GlobalSearch } from '@/components/global-search'
import { TrialBanner } from '@/components/TrialBanner'
import { currentUser } from '@clerk/nextjs/server'
import { ensureAccount, getAccountByClerkId } from '@/lib/accounts'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let trialDaysLeft: number | null = null

  try {
    const user = await currentUser()
    if (user) {
      await ensureAccount(
        user.id,
        user.emailAddresses[0]?.emailAddress ?? '',
        user.fullName ?? null,
      )

      // Calcular dias de trial restantes para o banner
      const account = await getAccountByClerkId(user.id)
      if (account?.estado === 'trial' && account.trial_ends_at) {
        const daysLeft = Math.ceil(
          // eslint-disable-next-line react-hooks/purity -- server component async, corre por request (não em render client)
          (new Date(account.trial_ends_at).getTime() - Date.now()) / 86400000
        )
        // Mostrar banner quando faltam 7 dias ou menos (e trial ainda não expirou)
        if (daysLeft >= 0 && daysLeft <= 7) {
          trialDaysLeft = daysLeft
        }
      }
    }
  } catch {
    // não bloqueia o render
  }

  return (
    <>
      <div className="h-dvh flex flex-col bg-background">
        {/* Banner de trial — aparece no topo quando trial expira em breve */}
        {trialDaysLeft !== null && <TrialBanner daysLeft={trialDaysLeft} />}

        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <SideNav />

          {/* Content column */}
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-y-auto min-w-0">
              {children}
            </main>

            {/* Mobile bottom nav — hidden on lg+ */}
            <BottomNav />
          </div>
        </div>

        {/* Global search palette — Cmd+K or / */}
        <GlobalSearch />
      </div>
      <Toaster richColors position="bottom-center" />
    </>
  )
}
