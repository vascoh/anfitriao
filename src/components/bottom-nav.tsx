'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MoreHorizontal, X, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useAlertsCount } from '@/hooks/use-alerts-count'
import { useTheme } from '@/hooks/use-theme'
import { NAV, CONTA_NAV, seccaoDe } from '@/lib/navigation'

/**
 * Barra inferior (mobile). Mostra as 4 secções mais usadas + "Mais".
 *
 * As restantes secções e toda a sub-navegação vivem no painel "Mais",
 * agrupadas por secção — o utilizador vê a mesma árvore que no desktop, em
 * vez de uma lista plana de 14 links sem hierarquia.
 */

/** Secções sempre visíveis na barra. As outras vão para o painel. */
const NA_BARRA = ['/hoje', '/calendario', '/reservas', '/propriedades']

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const alertsCount = useAlertsCount()
  const { isDark, setTheme } = useTheme()

  const barra = NAV.filter(s => NA_BARRA.includes(s.href))
  const seccaoAtual = seccaoDe(pathname)
  const foraDaBarra = !seccaoAtual || !NA_BARRA.includes(seccaoAtual.href)

  return (
    <>
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 max-w-lg mx-auto">
            <div className="mx-2 mb-1 max-h-[70dvh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
              <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mais</span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                  className="-m-2 grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {NAV.map(seccao => {
                const naBarra = NA_BARRA.includes(seccao.href)
                // Secções da barra só aparecem aqui se tiverem sub-navegação
                if (naBarra && !seccao.children) return null

                return (
                  <div key={seccao.href} className="border-b border-border last:border-0">
                    {!naBarra && (
                      <Link
                        href={seccao.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <seccao.Icon className="h-4 w-4 text-foreground/70" />
                        </div>
                        <span className="text-sm font-semibold">{seccao.label}</span>
                      </Link>
                    )}
                    {naBarra && (
                      <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {seccao.label}
                      </p>
                    )}
                    {seccao.children?.map(sub => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-3 pl-[4.25rem] pr-4 transition-colors hover:bg-muted/60"
                      >
                        <span className="text-sm">{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )
              })}

              <div className="border-b border-border">
                <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conta
                </p>
                {CONTA_NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 py-3 pl-[4.25rem] pr-4 transition-colors hover:bg-muted/60"
                  >
                    <span className="text-sm">{label}</span>
                  </Link>
                ))}
              </div>

              <button
                onClick={() => { setTheme(isDark ? 'light' : 'dark'); setOpen(false) }}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  {isDark ? <Sun className="h-4 w-4 text-foreground/70" /> : <Moon className="h-4 w-4 text-foreground/70" />}
                </div>
                <span className="text-sm font-medium">{isDark ? 'Modo claro' : 'Modo escuro'}</span>
              </button>
              <button
                onClick={() => signOut(() => router.push('/sign-in'))}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-destructive transition-colors hover:bg-destructive/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/8">
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
        className="lg:hidden flex shrink-0 items-stretch border-t border-border bg-card/95 backdrop-blur-sm"
        style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {barra.map(({ href, label, Icon }) => {
          const active = seccaoAtual?.href === href
          const showBadge = href === '/hoje' && alertsCount > 0
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-all ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold tabular-nums text-destructive-foreground">
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
          aria-expanded={open}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
            open || foraDaBarra ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MoreHorizontal className={`h-5 w-5 ${open || foraDaBarra ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
          <span className={`text-[10px] ${open || foraDaBarra ? 'font-semibold' : 'font-normal'}`}>Mais</span>
        </button>
      </nav>
    </>
  )
}
