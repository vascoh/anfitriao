import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const adminId = process.env.ADMIN_USER_ID

  if (!adminId) {
    // Protecção: se a variável não estiver definida, bloqueia o acesso
    redirect('/hoje')
  }

  if (!userId || userId !== adminId) {
    redirect('/hoje')
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Barra de topo do admin */}
      <header className="h-12 flex items-center gap-3 px-6 border-b border-border bg-card shrink-0">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
          <svg className="h-3.5 w-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.017 12C.017 18.267 5.107 23.25 12 23.25c6.89 0 11.983-4.985 11.983-11.25S18.89.75 12 .75a11.94 11.94 0 00-5.557 1.356" />
          </svg>
        </div>
        <span className="text-sm font-semibold">Anfitrião Admin</span>
        <span className="text-muted-foreground text-xs">·</span>
        <span className="text-muted-foreground text-xs">Painel de controlo</span>
        <div className="flex-1" />
        <a
          href="/hoje"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar à app
        </a>
      </header>

      {children}
    </div>
  )
}
