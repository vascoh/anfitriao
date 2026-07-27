'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'

export function ConnectButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Erro')
      window.location.href = data.url
    } catch {
      toast.error('Não foi possível iniciar a ligação à Stripe. Tenta novamente.')
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-2">
      <CreditCard className="h-4 w-4" />
      {loading ? 'A abrir a Stripe...' : label}
    </button>
  )
}
