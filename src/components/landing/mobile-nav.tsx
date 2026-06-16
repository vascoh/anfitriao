'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Prevent scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative z-50 flex min-h-11 min-w-11 flex-col items-center justify-center gap-[5px] p-2 md:hidden"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
      >
        <span
          className={`block h-[2px] w-5 rounded-full bg-foreground transition-all duration-200 ${
            open ? 'translate-y-[7px] rotate-45' : ''
          }`}
        />
        <span
          className={`block h-[2px] w-5 rounded-full bg-foreground transition-all duration-200 ${
            open ? 'opacity-0' : ''
          }`}
        />
        <span
          className={`block h-[2px] w-5 rounded-full bg-foreground transition-all duration-200 ${
            open ? '-translate-y-[7px] -rotate-45' : ''
          }`}
        />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        id="mobile-nav-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`fixed inset-x-0 top-[57px] z-40 border-b border-border bg-background transition-all duration-200 md:hidden ${
          open ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          <a
            href="#funcionalidades"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Funcionalidades
          </a>
          <a
            href="#como-funciona"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Como funciona
          </a>
          <a
            href="#precos"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Preços
          </a>
          <a
            href="#faq"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            FAQ
          </a>
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border py-3 text-center text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Começar grátis →
            </Link>
          </div>
        </nav>
      </div>
    </>
  )
}
