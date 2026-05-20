import { ClerkProvider } from '@clerk/nextjs'
import { SideNav } from '@/components/side-nav'
import { BottomNav } from '@/components/bottom-nav'
import { GlobalSearch } from '@/components/global-search'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
    <div className="h-dvh flex bg-background">
      {/* Desktop sidebar */}
      <SideNav />

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh">
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>

        {/* Mobile bottom nav — hidden on lg+ */}
        <BottomNav />
      </div>

      {/* Global search palette — Cmd+K or / */}
      <GlobalSearch />
    </div>
    </ClerkProvider>
  )
}
