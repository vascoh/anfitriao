'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Moon, Sun } from 'lucide-react'
import { useClerk, useUser } from '@clerk/nextjs'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAlertsCount } from '@/hooks/use-alerts-count'
import { useTheme } from '@/hooks/use-theme'
import { NAV, CONTA_NAV, ADMIN_NAV, rotaAtiva, seccaoDe, type NavSection } from '@/lib/navigation'

/**
 * Sub-navegação sem ter de lá entrar primeiro.
 *
 * A regra dos seis destinos de topo está certa e não muda: catorze itens
 * planos era o que ninguém descobria. Mas a consequência era que `/canais`,
 * `/conformidade` e `/faturacao` não existiam para quem ainda não tinha
 * clicado em «Alojamentos» ou «Receita» — e não existir é o que se dizia de
 * uma funcionalidade que está lá.
 *
 * O painel **flutua** em vez de abrir em linha. Abrir em linha empurra os
 * itens de baixo para longe enquanto o rato desce sobre eles: quem passa por
 * «Reservas» a caminho de «Receita» vê o alvo fugir. Um painel sobreposto não
 * mexe em nada do que está por baixo.
 *
 * Posicionado com `fixed` e as coordenadas do próprio item, porque a lista tem
 * `overflow-y-auto` — um filho absoluto seria cortado pela caixa que rola.
 */
const LARGURA_BARRA = '14rem' // w-56
/** Altura estimada do painel, para não o abrir por baixo do fundo do ecrã. */
function alturaEstimada(n: number): number {
  return n * 36 + 16
}

function SubNavFlutuante({
  seccao, top, pathname, aoEntrar, aoSair, aoNavegar,
}: {
  seccao: NavSection
  top: number
  pathname: string
  aoEntrar: () => void
  aoSair: () => void
  aoNavegar: () => void
}) {
  const filhos = seccao.children ?? []
  const maxTop = typeof window === 'undefined'
    ? top
    : Math.min(top, window.innerHeight - alturaEstimada(filhos.length) - 12)

  return (
    <div
      role="group"
      aria-label={seccao.label}
      onMouseEnter={aoEntrar}
      onMouseLeave={aoSair}
      style={{ top: Math.max(8, maxTop), left: LARGURA_BARRA }}
      className="fixed z-50 ml-1 w-52 rounded-xl border border-border bg-card p-1.5 shadow-lg"
    >
      <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {seccao.label}
      </p>
      {filhos.map(sub => (
        <Link
          key={sub.href}
          href={sub.href}
          onClick={aoNavegar}
          className={`block rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
            rotaAtiva(pathname, sub.href)
              ? 'bg-primary/10 text-primary'
              : 'text-foreground/70 hover:bg-muted hover:text-foreground'
          }`}
        >
          {sub.label}
        </Link>
      ))}
    </div>
  )
}

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useClerk()
  const { user } = useUser()
  const alertsCount = useAlertsCount()
  const { isDark, setTheme } = useTheme()
  const isAdmin = user?.id === process.env.NEXT_PUBLIC_ADMIN_USER_ID

  const seccaoAtual = seccaoDe(pathname)

  /* Qual secção tem o painel aberto, e a que altura o desenhar. */
  const [flutuante, setFlutuante] = useState<{ href: string; top: number } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelarFecho = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current)
      temporizador.current = null
    }
  }, [])

  /* Fechar com atraso: entre o item e o painel há um milímetro de nada, e
   * fechar no instante em que o rato lá passa torna o painel inalcançável. */
  const agendarFecho = useCallback(() => {
    cancelarFecho()
    temporizador.current = setTimeout(() => setFlutuante(null), 140)
  }, [cancelarFecho])

  const abrir = useCallback((href: string, alvo: HTMLElement) => {
    cancelarFecho()
    setFlutuante({ href, top: alvo.getBoundingClientRect().top })
  }, [cancelarFecho])

  /* Fecha-se onde o utilizador o fecha: ao clicar num destino, ao sair com o
   * rato, e com Escape. Não há efeito preso ao `pathname` — o painel da secção
   * onde já se está nunca chega a ser desenhado (`comPainel`), portanto não há
   * estado a limpar depois de navegar. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlutuante(null) }
    window.addEventListener('keydown', aoTeclar)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  /* Nunca a secção onde já se está: essa mostra os filhos em linha, e navegar
   * para dentro dela faz o painel deixar de existir sem ninguém o fechar. */
  const seccaoFlutuante = flutuante && flutuante.href !== seccaoAtual?.href
    ? NAV.find(s => s.href === flutuante.href)
    : undefined

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
        {NAV.map(({ href, label, Icon, children }) => {
          const emSeccao = seccaoAtual?.href === href
          const exato = rotaAtiva(pathname, href)
          const showBadge = href === '/hoje' && alertsCount > 0

          /* A secção ativa já mostra os filhos em linha — abrir-lhe também o
           * painel seria dizer duas vezes a mesma coisa, uma por cima da outra. */
          const comPainel = !!children && !emSeccao

          return (
            <div
              key={href}
              onMouseEnter={comPainel ? e => abrir(href, e.currentTarget) : undefined}
              onMouseLeave={comPainel ? agendarFecho : undefined}
              // Também com o teclado: quem navega por tabulação tem de chegar
              // aos mesmos sítios que quem tem rato.
              onFocus={comPainel ? e => abrir(href, e.currentTarget) : undefined}
              onBlur={comPainel ? agendarFecho : undefined}
            >
              <Link href={href}
                onClick={() => setFlutuante(null)}
                aria-haspopup={comPainel || undefined}
                aria-expanded={comPainel ? flutuante?.href === href : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  exato
                    ? 'bg-primary/10 text-primary'
                    : emSeccao
                      ? 'text-foreground'
                      : 'text-foreground/65 hover:bg-muted hover:text-foreground'
                }`}>
                <Icon className={`h-4 w-4 shrink-0 ${emSeccao ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {alertsCount > 9 ? '9+' : alertsCount}
                  </span>
                )}
              </Link>

              {/* Sub-navegação: só existe dentro da secção ativa */}
              {emSeccao && children && (
                <div className="mt-0.5 mb-1 ml-[1.4rem] flex flex-col gap-0.5 border-l border-border pl-3">
                  {children.map(sub => (
                    <Link key={sub.href} href={sub.href}
                      className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                        rotaAtiva(pathname, sub.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/55 hover:bg-muted hover:text-foreground'
                      }`}>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Admin — só para o administrador. A lista vive em `ADMIN_NAV` para
            ser a mesma aqui, na barra do telemóvel e no ⌘K. */}
        {isAdmin && (
          <>
            <div className="my-2 h-px bg-border" />
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            {ADMIN_NAV.map(({ href, label, Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  rotaAtiva(pathname, href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                <Icon className="h-4 w-4 shrink-0 stroke-[1.5]" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Conta — fora da navegação principal, para não roubar um dos 6 lugares */}
      <div className="border-t border-border p-2 shrink-0 flex flex-col gap-0.5">
        {CONTA_NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              rotaAtiva(pathname, href)
                ? 'bg-primary/10 text-primary'
                : 'text-foreground/55 hover:bg-muted hover:text-foreground'
            }`}>
            <Icon className="h-3.5 w-3.5 shrink-0 stroke-[1.5]" />
            {label}
          </Link>
        ))}
      </div>

      {flutuante && seccaoFlutuante && (
        <SubNavFlutuante
          seccao={seccaoFlutuante}
          top={flutuante.top}
          pathname={pathname}
          aoEntrar={cancelarFecho}
          aoSair={agendarFecho}
          aoNavegar={() => setFlutuante(null)}
        />
      )}

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
