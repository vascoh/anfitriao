'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  daysLeft: number
}

/**
 * Aviso do fim do período experimental.
 *
 * Era branco sobre âmbar-500 (cerca de 2:1, abaixo do mínimo de 4,5:1) e
 * vermelho com `dark:` soltos. Passa aos tokens: faixa clara com texto
 * normal e o botão no acento; quando expira ou faltam dois dias, a faixa
 * ganha a cor de erro no ícone e no rebordo, sem perder o contraste do texto.
 */
export function TrialBanner({ daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const expirou = daysLeft < 0
  const urgente = daysLeft <= 2

  const msg = expirou
    ? 'O teu período experimental terminou. Escolhe um plano para continuares a usar o Anfitrião.'
    : daysLeft === 0
    ? 'O teu período experimental termina hoje.'
    : daysLeft === 1
    ? 'O teu período experimental termina amanhã.'
    : `O teu período experimental termina dentro de ${daysLeft} dias.`

  return (
    <div
      role={urgente ? 'alert' : 'status'}
      className={`flex shrink-0 items-center gap-3 border-b px-4 py-2 text-sm text-foreground ${
        urgente ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted'
      }`}
    >
      <AlertTriangle
        className={`size-4 shrink-0 ${urgente ? 'text-destructive' : 'text-primary'}`}
        aria-hidden
      />
      <span className="flex-1 font-medium">{msg}</span>
      <Link
        href="/conta/billing"
        className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity active:opacity-80"
      >
        Escolher plano
      </Link>
      {/* Expirado não se fecha: é a única pista de que a app deixou de servir. */}
      {!expirou && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Fechar aviso"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
