'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { Menu, X, Home } from 'lucide-react'
import { EASE_OUT } from '@/lib/landing-animations'

const NAV = [
  { label: 'Plataforma', href: '#plataforma' },
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
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-slate-900/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl text-lg font-bold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30">
            <Home className="size-4 text-cyan-400" aria-hidden />
          </span>
          Anfitri<span className="-ml-[0.5ch] text-cyan-400">ão</span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md text-sm font-medium text-slate-300 transition-colors hover:text-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/sign-in"
            className="rounded-md text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
          >
            Entrar
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-shadow hover:shadow-xl hover:shadow-cyan-500/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
            >
              Começar grátis
            </Link>
          </motion.div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className="grid size-10 place-items-center rounded-xl text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 lg:hidden"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="overflow-hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Principal (mobile)">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-cyan-400"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-cyan-400"
              >
                Entrar
              </Link>
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-cyan-500 px-5 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20"
              >
                Começar grátis
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
