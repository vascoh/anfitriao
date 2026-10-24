'use client'

import { useState } from 'react'
import { Mail, CheckCircle2 } from 'lucide-react'

export function ReminderButton({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  async function send() {
    setState('sending')
    try {
      const res = await fetch('/api/notify-payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      setState(res.ok ? 'sent' : 'error')
      if (res.ok) setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
    }
  }
  return (
    <button
      onClick={send}
      disabled={state === 'sending' || state === 'sent'}
      className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
        state === 'sent' ? 'bg-emerald-100 text-emerald-700' :
        state === 'error' ? 'bg-red-100 text-red-700' :
        'bg-amber-100 text-amber-700 hover:bg-amber-200'
      }`}
    >
      <Mail className="h-3 w-3" />
      {state === 'sending' ? '...' : state === 'sent' ? 'Enviado' : state === 'error' ? 'Erro' : 'Lembrete'}
    </button>
  )
}

export function Stepper({ estado }: { estado: string }) {
  const steps = [
    { key: 'pendente', label: 'Pendente' },
    { key: 'confirmada', label: 'Confirmada' },
    { key: 'checkin', label: 'Em casa' },
    { key: 'checkout', label: 'Concluída' },
  ]
  const currentIdx = steps.findIndex(s => s.key === estado)

  return (
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar py-1">
      {steps.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.key} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                done ? 'border-primary bg-primary' : active ? 'border-primary bg-primary/10' : 'border-border bg-card'
              }`}>
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                ) : active ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${active ? 'font-semibold text-primary' : done ? 'text-primary/70' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 transition-colors ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4">{title}</h2>}
      <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden">{children}</div>
    </div>
  )
}

export function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-0 ${className ?? ''}`}>
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}
