import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase'

export interface PushPayload {
  title: string
  body: string
  /** Rota a abrir ao tocar na notificação (ex: /reservas/abc) */
  url?: string
}

function vapidConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/**
 * Envia uma notificação push a todos os dispositivos subscritos do anfitrião.
 * Subscrições mortas (404/410 do push service) são removidas.
 * Nunca lança — falha de push não pode bloquear o fluxo que a dispara.
 */
export async function sendPushToOwner(ownerId: string | null | undefined, payload: PushPayload): Promise<number> {
  if (!ownerId || !vapidConfigured()) return 0

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:suporte@anfitrioes.pt',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const supabase = createAdminClient()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('owner_id', ownerId)

  if (error || !subs?.length) return 0

  const body = JSON.stringify(payload)
  let sent = 0

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // subscrição expirada/revogada — limpar
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[push] send falhou', status, sub.endpoint.slice(0, 60))
      }
    }
  }))

  return sent
}
