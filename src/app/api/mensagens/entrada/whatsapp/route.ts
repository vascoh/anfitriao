import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { LIMITE_CORPO, normalizarTelefone } from '@/lib/mensagens'
import { assinaturaMetaValida, gravarMensagem, ligacaoWhatsAppDoNumero, reservaDoTelefone } from '@/lib/mensagens-server'
import { sendPushToOwner } from '@/lib/push'
import { today } from '@/lib/utils'

/**
 * Webhook da Cloud API do WhatsApp (Meta).
 *
 * GET  — verificação da subscrição: a Meta envia o `hub.verify_token` que o
 *        anfitrião copiou da página de ligação; responde-se com o desafio.
 * POST — mensagens recebidas. Cada anfitrião tem a sua app e o seu segredo:
 *        lê-se o `phone_number_id` do corpo só para escolher o segredo, e
 *        nada se grava antes de a assinatura `X-Hub-Signature-256` bater.
 */

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const token = p.get('hub.verify_token')
  if (p.get('hub.mode') !== 'subscribe' || !token) return new NextResponse('Pedido inválido', { status: 400 })
  const supabase = createAdminClient()
  const { data } = await supabase.from('whatsapp_ligacoes').select('owner_id').eq('verify_token', token).maybeSingle()
  if (!data) return new NextResponse('Token desconhecido', { status: 403 })
  return new NextResponse(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

interface MensagemMeta {
  from: string
  id: string
  timestamp?: string
  type: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }
  location?: { latitude?: number; longitude?: number; name?: string }
}

interface ValorMeta {
  metadata?: { phone_number_id?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: MensagemMeta[]
}

/** Texto a mostrar de uma mensagem que não é texto (foto, áudio, localização…). */
function textoDe(m: MensagemMeta): string {
  if (m.type === 'text') return m.text?.body ?? ''
  if (m.type === 'button') return m.button?.text ?? ''
  if (m.type === 'interactive') return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ''
  if (m.type === 'location' && m.location) {
    return `📍 Localização${m.location.name ? `: ${m.location.name}` : ''} (${m.location.latitude}, ${m.location.longitude})`
  }
  const tipos: Record<string, string> = {
    image: '📷 Fotografia', audio: '🎤 Mensagem de voz', video: '🎬 Vídeo', document: '📄 Documento', sticker: 'Autocolante',
  }
  return `${tipos[m.type] ?? `Mensagem (${m.type})`} — abre no WhatsApp para ver.`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
  const rl = await verificarLimite(`entrada-whatsapp:${ip}`, 300, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })

  const corpo = await req.text()
  let dados: { entry?: { changes?: { value?: ValorMeta }[] }[] }
  try {
    dados = JSON.parse(corpo)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const valores = (dados.entry ?? []).flatMap(e => (e.changes ?? []).map(c => c.value).filter((v): v is ValorMeta => Boolean(v)))
  const phoneNumberId = valores.find(v => v.metadata?.phone_number_id)?.metadata?.phone_number_id
  if (!phoneNumberId) return NextResponse.json({ ignorado: 'sem número' })

  const supabase = createAdminClient()
  const ligacao = await ligacaoWhatsAppDoNumero(supabase, phoneNumberId)
  if (!ligacao) return NextResponse.json({ ignorado: 'número não ligado' })
  if (!assinaturaMetaValida(corpo, req.headers.get('x-hub-signature-256'), ligacao.app_secret)) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  const hoje = today()
  for (const v of valores) {
    if (v.metadata?.phone_number_id !== phoneNumberId) continue
    for (const m of v.messages ?? []) {
      const telefone = normalizarTelefone(m.from)
      const texto = textoDe(m).slice(0, LIMITE_CORPO).trim()
      if (!telefone || !texto) continue
      const perfil = v.contacts?.find(c => c.wa_id === m.from)?.profile?.name ?? null
      const { reserva_id, hospede_id, nome } = await reservaDoTelefone(supabase, ligacao.owner_id, telefone, hoje)
      const quando = m.timestamp ? new Date(Number(m.timestamp) * 1000) : null
      const r = await gravarMensagem(supabase, {
        owner_id: ligacao.owner_id,
        reserva_id,
        hospede_id,
        canal: 'whatsapp',
        direcao: 'entrada',
        estado: 'recebida',
        corpo: texto,
        contacto: telefone,
        nome_contacto: (perfil ?? nome)?.slice(0, 200) ?? null,
        id_externo: m.id,
        ...(quando && !Number.isNaN(quando.getTime()) ? { criado_em: quando.toISOString() } : {}),
      })
      if (!r.ok) {
        console.error('[entrada-whatsapp] gravação falhou', r.erro)
        return NextResponse.json({ error: 'Falha ao gravar.' }, { status: 500 })
      }
      if (!r.duplicada) {
        await sendPushToOwner(ligacao.owner_id, {
          title: `WhatsApp de ${nome ?? perfil ?? `+${telefone}`}`,
          body: texto.slice(0, 120),
          url: reserva_id ? `/mensagens?reserva=${reserva_id}` : '/mensagens',
        })
      }
    }
  }
  // Estados de entrega (`statuses`) chegam aqui também; por agora ignoram-se.
  return NextResponse.json({ ok: true })
}
