'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

// Último recurso: só aparece quando o próprio layout raiz rebenta.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-PT">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Algo correu mal</h1>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>
          O erro foi registado. Tenta recarregar a página.
        </p>
        <Link href="/" style={{ color: '#0f766e' }}>Voltar ao início</Link>
      </body>
    </html>
  )
}
