'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { APP_URL } from '@/lib/config'

const nada = () => () => {}

/**
 * Para onde leva «início»: um hóspede no site de um anfitrião (em /r/<slug> ou
 * num domínio próprio) volta ao site; só quem está na app vai para /hoje.
 */
function inicio(): { href: string; rotulo: string } {
  const { hostname, pathname } = window.location
  let plataforma = 'anfitrioes.pt'
  try { plataforma = new URL(APP_URL).hostname } catch { /* usa a origem de produção */ }
  const naPlataforma = hostname === plataforma || hostname.endsWith(`.${plataforma}`) ||
    hostname === 'localhost' || hostname.endsWith('.vercel.app')
  if (!naPlataforma) return { href: '/', rotulo: 'Ir para o site' }
  const site = pathname.match(/^\/r\/[^/]+/)
  if (site) return { href: site[0], rotulo: 'Ir para o site' }
  return { href: '/hoje', rotulo: 'Ir para o início' }
}

const APP = JSON.stringify({ href: '/hoje', rotulo: 'Ir para o início' })

export default function NotFound() {
  // Serializado para o snapshot ser estável entre renders.
  const destino = JSON.parse(useSyncExternalStore(nada, () => JSON.stringify(inicio()), () => APP)) as { href: string; rotulo: string }
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-4 text-center bg-background">
      <div className="flex flex-col gap-1">
        <p className="text-7xl font-bold text-primary/20 tabular-nums">404</p>
        <h2 className="text-xl font-semibold">Página não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          Esta página não existe ou foi movida.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link
          href={destino.href}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity"
        >
          <Home className="h-4 w-4" />
          {destino.rotulo}
        </Link>
        <button
          onClick={() => history.back()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    </div>
  )
}
