'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, CalendarCheck2, CalendarDays, Users,
  Sparkles, FileText, Building2, Globe, TrendingUp, Search, Tag, Moon, Sun, ShieldCheck, CreditCard, UserRound,
} from 'lucide-react'
import { useClerk, useUser } from '@clerk/nextjs'
import { useAlertsCount } from '@/hooks/use-alerts-count'
import { useTheme } from '@/hooks/use-theme'

const primary = [
  { href: '/hoje', label: 'Hoje', Icon: Home },
  { href: '/reservas', label: 'Reservas', Icon: CalendarCheck2 },
  { href: '/calendario', label: 'Calendário', Icon: CalendarDays },
  { href: '/hospedes', label: 'Hóspedes', Icon: Users },
]

const secondary = [
  { href: '/precos', label: 'Preços', Icon: Tag },
  { href: '/relatorios', label: 'Relatórios', Icon: TrendingUp },
  { href: '/concierge', label: 'Concierge IA', Icon: Sparkles },
  { href: '/propriedades', label: 'Propriedades', Icon: Building2 },
  { href: '/website', label: 'Website', Icon: Globe },
  { href: '/documentos', label: 'Documentos SIBA', Icon: FileText },
  { href: '/conta/perfil', label: 'Perfil', Icon: UserRound },
  { href: '/conta/billing', label: 'Subscrição', Icon: CreditCard },
]

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()
  const { user } = useUser()
  const alertsCount = useAlertsCount()
  const { isDark, setTheme } = useTheme()
  const isAdmin = user?.id === process.env.NEXT_PUBLIC_ADMIN_USER_ID

  function active(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 h-dvh border-r border-border bg-card">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-3 border-b border-border shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
          </svg>
        </div>
        <span className="font-bold text-base tracking-tight">Anfitrião</span>
      </div>

      {/* Search trigger */}
      <div className="px-2 py-2 border-b border-border">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Pesquisar...</span>
          <span className="font-mono text-[10px] opacity-50">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {primary.map(({ href, label, Icon }) => {
          const showBadge = href === '/hoje' && alertsCount > 0
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/65 hover:bg-muted hover:text-foreground'
              }`}>
              <Icon className={`h-4 w-4 shrink-0 ${active(href) ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {alertsCount > 9 ? '9+' : alertsCount}
                </span>
              )}
            </Link>
          )
        })}

        <div className="my-2 h-px bg-border" />

        {secondary.map(({ href, label, Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active(href)
                ? 'bg-primary/10 text-primary'
                : 'text-foreground/65 hover:bg-muted hover:text-foreground'
            }`}>
            <Icon className={`h-4 w-4 shrink-0 ${active(href) ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
            {label}
          </Link>
        ))}

        {/* Admin link — só visível para o admin */}
        {isAdmin && (
          <>
            <div className="my-2 h-px bg-border" />
            <Link href="/admin/contas"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <ShieldCheck className="h-4 w-4 shrink-0 stroke-[1.5]" />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border p-2 shrink-0 flex flex-col gap-0.5">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {isDark ? 'Modo claro' : 'Modo escuro'}
        </button>
        <button
          onClick={() => signOut(() => router.push('/sign-in'))}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Terminar sessão
        </button>
      </div>
    </aside>
  )
}
