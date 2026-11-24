import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'

const supabase = createAdminClient()

/** Quem leu os calendários exportados deste anfitrião. Ver `lib/ical-leitores.ts`. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('ical_leituras')
    .select('propriedade_id, leitor, origem, ultima_leitura')
    .eq('owner_id', userId)
    .order('ultima_leitura', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Não foi possível ler.' }, { status: 500 })
  return NextResponse.json({ leituras: data ?? [] })
}
