import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'

const supabase = createAdminClient()

const MAX_FIELD = 2048

/** POST /api/push — guarda a subscrição Web Push do dispositivo do anfitrião. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth

  if (
    typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > MAX_FIELD ||
    typeof p256dh !== 'string' || !p256dh || p256dh.length > MAX_FIELD ||
    typeof authKey !== 'string' || !authKey || authKey.length > MAX_FIELD
  ) {
    return NextResponse.json({ error: 'Subscrição inválida' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { owner_id: userId, endpoint, p256dh, auth: authKey },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('[push] subscribe', error.message)
    return NextResponse.json({ error: 'Erro ao guardar subscrição' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/push — remove a subscrição do dispositivo atual. */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) {
    return NextResponse.json({ error: 'endpoint em falta' }, { status: 400 })
  }

  // Só apaga subscrições do próprio utilizador
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('owner_id', userId)

  if (error) {
    console.error('[push] unsubscribe', error.message)
    return NextResponse.json({ error: 'Erro ao remover subscrição' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
