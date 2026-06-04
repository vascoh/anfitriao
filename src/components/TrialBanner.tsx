'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  daysLeft: number
}

export function TrialBanner({ daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const isUrgent = daysLeft <= 2
  const bg    = isUrgent
    ? 'bg-red-600 dark:bg-red-700'
    : 'bg-amber-500 dark:bg-amber-600'

  const msg = daysLeft === 0
    ? 'O teu trial expira hoje.'
    : daysLeft === 1
    ? 'O teu trial expira amanhã.'
    : `O teu trial expira em ${daysLeft} dias.`

  return (
    <div className={`${bg} text-white px-4 py-2 flex items-center gap-3 text-sm shrink-0`}>
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span className="flex-1 font-medium">{msg}</span>
      <Link
        href="/conta/billing"
        className="rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap"
      >
        Escolher plano →
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Fechar"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
