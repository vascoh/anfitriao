'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  priceId: string
  label: string
  disabled?: boolean
  variant?: 'primary' | 'outline'
}

export function UpgradeButton({ priceId, label, disabled, variant = 'primary' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Erro ao iniciar pagamento.')
        setLoading(false)
      }
    } catch {
      toast.error('Erro de ligação. Tenta de novo.')
      setLoading(false)
    }
  }

  const base = 'w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50'
  const styles = variant === 'primary'
    ? `${base} bg-primary text-primary-foreground hover:opacity-90`
    : `${base} border border-border text-foreground hover:bg-muted`

  return (
    <button onClick={handleClick} disabled={disabled || loading} className={styles}>
      {loading ? 'A redirecionar…' : label}
    </button>
  )
}
