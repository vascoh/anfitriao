'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarCheck2, CalendarDays, Users, MoreHorizontal, Sparkles, FileText, Building2, Globe, TrendingUp, X, Tag, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
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
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const alertsCount = useAlertsCount()
  const { isDark, setTheme } = useTheme()

  const isSecondaryActive = secondary.some(s => pathname.startsWith(s.href))

  return (
    <>
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 max-w-lg mx-auto">
            <div className="mx-2 mb-1 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mais</span>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {secondary.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 transition-colors border-b border-border last:border-0"
                >
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5 text-foreground/70" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              ))}
              {/* Dark mode toggle */}
              <button
                onClick={() => { setTheme(isDark ? 'light' : 'dark'); setOpen(false) }}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-muted/60 transition-colors border-b border-border"
              >
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {isDark ? <Sun className="h-4.5 w-4.5 text-foreground/70" /> : <Moon className="h-4.5 w-4.5 text-foreground/70" />}
                </div>
                <span className="text-sm font-medium">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
              </button>
              <button
                onClick={() => signOut(() => router.push('/sign-in'))}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left text-destructive hover:bg-destructive/5 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-destructive/8 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav
        className="lg:hidden border-t border-border bg-card/95 backdrop-blur-sm flex items-stretch shrink-0"
        style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const showBadge = href === '/hoje' && alertsCount > 0
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-all ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {alertsCount > 9 ? '9+' : alertsCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            open || isSecondaryActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MoreHorizontal className={`h-5 w-5 ${open || isSecondaryActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
          <span className={`text-[10px] ${open || isSecondaryActive ? 'font-semibold' : 'font-normal'}`}>Mais</span>
        </button>
      </nav>
    </>
  )
}
