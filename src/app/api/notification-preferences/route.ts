import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getNotificationPreferences, upsertNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const prefs = await getNotificationPreferences(userId)
  return NextResponse.json(prefs)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json() as Partial<NotificationPreferences>
  const prefs: NotificationPreferences = {
    nova_reserva_email: body.nova_reserva_email !== false,
    nova_reserva_push: body.nova_reserva_push !== false,
  }

  const { error } = await upsertNotificationPreferences(userId, prefs)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
