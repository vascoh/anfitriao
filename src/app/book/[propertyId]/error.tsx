'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function BookPropertyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[BookPropertyPage error]', error)
  }, [error])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 text-center bg-background">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Erro ao carregar o alojamento</p>
        <p className="text-sm text-muted-foreground">Ocorreu um problema inesperado. Tenta novamente.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Tentar novamente
        </button>
        <Link href="/book" className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold">
          Ver alojamentos
        </Link>
      </div>
    </div>
  )
}
