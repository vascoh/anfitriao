'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-full gap-6 px-4 py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="text-lg font-semibold">Algo correu mal</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ocorreu um erro inesperado. Tenta de novo ou volta ao início.
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold active:opacity-80 transition-opacity"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
        <Link
          href="/hoje"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
