import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { APP_URL } from '@/lib/config'
import { estaConfigurada } from '@/lib/crypto'
import { cifrarSegredosWhatsApp, rececaoEmailAtiva } from '@/lib/mensagens-server'

/**
 * Ligação do número WhatsApp Business do anfitrião (Cloud API da Meta).
 *
 * O token e o segredo da app nunca voltam ao browser: o GET só diz se há
 * ligação, o número e o que é preciso copiar para a Meta (URL do webhook e
 * token de verificação).
 */

const supabase = createAdminClient()
const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}`
const WEBHOOK = `${APP_URL}/api/mensagens/entrada/whatsapp`

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data, error } = await supabase
    .from('whatsapp_ligacoes')
    .select('phone_number_id, numero_exibido, verify_token, atualizado_em')
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ligado: Boolean(data),
    phone_number_id: data?.phone_number_id ?? null,
    numero_exibido: data?.numero_exibido ?? null,
    verify_token: data?.verify_token ?? null,
    atualizado_em: data?.atualizado_em ?? null,
    webhook: WEBHOOK,
    cifraDisponivel: estaConfigurada(),
    rececaoEmail: rececaoEmailAtiva(),
  })
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const phoneNumberId = typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const appSecret = typeof body.app_secret === 'string' ? body.app_secret.trim() : ''
  if (!/^\d{5,30}$/.test(phoneNumberId)) return NextResponse.json({ error: 'O «Phone number ID» é um número comprido, sem espaços.' }, { status: 400 })
  if (token.length < 20 || token.length > 1000) return NextResponse.json({ error: 'O token de acesso não parece válido.' }, { status: 400 })
  if (!/^[a-f0-9]{16,128}$/i.test(appSecret)) return NextResponse.json({ error: 'O «App secret» não parece válido.' }, { status: 400 })

  const cifrados = cifrarSegredosWhatsApp(token, appSecret)
  if (!cifrados) return NextResponse.json({ error: 'A cifra de segredos não está configurada no servidor.' }, { status: 503 })

  // Confirmar com a Meta antes de gravar: um token errado só se descobria no
  // primeiro envio, à frente do hóspede.
  let numeroExibido: string | null = null
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    const dados = await res.json().catch(() => null) as { display_phone_number?: string; error?: { message?: string } } | null
    if (!res.ok) {
      return NextResponse.json({ error: `A Meta recusou a ligação: ${dados?.error?.message ?? res.status}` }, { status: 400 })
    }
    numeroExibido = dados?.display_phone_number ?? null
  } catch {
    return NextResponse.json({ error: 'Não foi possível contactar a Meta. Tenta outra vez.' }, { status: 502 })
  }

  const { data: atual } = await supabase.from('whatsapp_ligacoes').select('verify_token').eq('owner_id', userId).maybeSingle()
  const { error } = await supabase.from('whatsapp_ligacoes').upsert({
    owner_id: userId,
    phone_number_id: phoneNumberId,
    numero_exibido: numeroExibido,
    ...cifrados,
    verify_token: atual?.verify_token ?? randomBytes(18).toString('base64url'),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'owner_id' })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Este número já está ligado a outra conta.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return GET()
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { error } = await supabase.from('whatsapp_ligacoes').delete().eq('owner_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
