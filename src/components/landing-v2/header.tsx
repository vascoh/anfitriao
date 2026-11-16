'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Marca } from '@/components/marca'
import { BOTAO_PRIMARIO, FOCO } from './estilos'

const NAV = [
  { label: 'Plataforma', href: '#plataforma' },
  // O posicionamento (2026-11-16) é a prova; a calculadora fica na página, fora do menu.
  { label: 'Dossiê', href: '#prova' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Preços', href: '#precos' },
  // 'Blog' sai enquanto /blog não existir — a rota manda o visitante para o login.
]

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Trava o scroll do body enquanto o menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? 'border-border bg-background/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Anfitrião, início" className={`rounded-lg ${FOCO}`}>
          <Marca />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${FOCO}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/sign-in"
            className={`rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${FOCO}`}
          >
            Entrar
          </Link>
          <Link href="/sign-up" className={`${BOTAO_PRIMARIO} h-10 px-5 text-sm`}>
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className={`grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted lg:hidden ${FOCO}`}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <div
          id="menu-mobile"
          className="fade-up h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background lg:hidden"
        >
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Principal (mobile)">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              onClick={() => setOpen(false)}
              className={`${BOTAO_PRIMARIO} mt-3 h-12 px-5 text-base`}
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
