import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { WebsiteSettings } from '@/lib/types'

const supabase = createAdminClient()

/**
 * POST /api/website-settings
 * Upserts website settings for the authenticated owner.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json() as WebsiteSettings

  const { data: existing } = await supabase
    .from('website_settings')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('website_settings')
      .update({ ...body, owner_id: userId })
      .eq('owner_id', userId)
    if (error) {
      console.error('[POST /api/website-settings]', error.message)
      return NextResponse.json({ error: 'Erro ao guardar.' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('website_settings')
      .insert({ ...body, owner_id: userId })
    if (error) {
      console.error('[POST /api/website-settings]', error.message)
      return NextResponse.json({ error: 'Erro ao guardar.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
