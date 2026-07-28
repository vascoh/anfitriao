'use client'

import { Printer } from 'lucide-react'

export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      Imprimir
    </button>
  )
}
