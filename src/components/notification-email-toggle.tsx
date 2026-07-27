'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, MailX } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Toggle de notificação por email quando entra uma nova reserva.
 * Independente do PushToggle (push é por dispositivo; email é por conta).
 */
export function NotificationEmailToggle() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [pushPref, setPushPref] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/notification-preferences')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setEnabled(data.nova_reserva_email !== false)
          setPushPref(data.nova_reserva_push !== false)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const next = !enabled
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nova_reserva_email: next, nova_reserva_push: pushPref }),
      })
      if (!res.ok) throw new Error()
      setEnabled(next)
      toast.success(next ? 'Notificações por email ativadas' : 'Notificações por email desativadas')
    } catch {
      toast.error('Não foi possível guardar a preferência')
    } finally {
      setBusy(false)
    }
  }, [busy, enabled, pushPref])

  if (loading) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-3 text-left disabled:opacity-60"
    >
      {enabled
        ? <Mail className="h-5 w-5 text-primary shrink-0" />
        : <MailX className="h-5 w-5 text-muted-foreground shrink-0" />}
      <div className="flex-1">
        <p className="text-sm font-medium">Notificações por email</p>
        <p className="text-xs text-muted-foreground">
          {enabled ? 'Recebes um email a cada nova reserva' : 'Emails de nova reserva desativados'}
        </p>
      </div>
      <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
