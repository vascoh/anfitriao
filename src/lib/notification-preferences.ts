import 'server-only'
import { createAdminClient } from '@/lib/supabase'

export interface NotificationPreferences {
  nova_reserva_email: boolean
  nova_reserva_push: boolean
}

const DEFAULTS: NotificationPreferences = {
  nova_reserva_email: true,
  nova_reserva_push: true,
}

export async function getNotificationPreferences(ownerId: string | null | undefined): Promise<NotificationPreferences> {
  if (!ownerId) return DEFAULTS
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select('nova_reserva_email, nova_reserva_push')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (!data) return DEFAULTS
  return data as NotificationPreferences
}

export async function upsertNotificationPreferences(
  ownerId: string,
  prefs: NotificationPreferences,
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ owner_id: ownerId, ...prefs }, { onConflict: 'owner_id' })
  if (error) {
    console.error('[upsertNotificationPreferences]', error.message)
    return { error: 'Erro ao guardar preferências.' }
  }
  return {}
}
