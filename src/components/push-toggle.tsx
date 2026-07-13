'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/**
 * Toggle de notificações push (nova reserva → dispositivo do anfitrião).
 * Suporte depende do browser: iOS Safari requer app instalada no ecrã inicial.
 */
export function PushToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    let cancelled = false
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (cancelled) return
        setSupported(true)
        setEnabled(!!sub)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [vapidKey])

  const toggle = useCallback(async () => {
    if (busy || !vapidKey) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready

      if (enabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setEnabled(false)
        toast.success('Notificações desativadas')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Permissão de notificações recusada no browser')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error()

      setEnabled(true)
      toast.success('Notificações ativadas neste dispositivo')
    } catch {
      toast.error('Não foi possível ativar as notificações')
    } finally {
      setBusy(false)
    }
  }, [busy, enabled, vapidKey])

  if (!supported) return null

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Notificações</p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-3 text-left disabled:opacity-60"
      >
        {enabled
          ? <Bell className="h-5 w-5 text-primary shrink-0" />
          : <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />}
        <div className="flex-1">
          <p className="text-sm font-medium">Notificações de novas reservas</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? 'Ativas neste dispositivo' : 'Recebe um alerta no telemóvel quando entra uma reserva'}
          </p>
        </div>
        <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </section>
  )
}
