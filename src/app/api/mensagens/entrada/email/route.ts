import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { lerEmailRecebido, verificarEmailRecebido } from '@/lib/email/providers/resend'
import { enderecoEmail, htmlParaTexto, limparRespostaEmail, nomeDoRemetente, LIMITE_ASSUNTO, LIMITE_CORPO } from '@/lib/mensagens'
import { gravarMensagem, reservaDoEmail, reservaDoEndereco } from '@/lib/mensagens-server'
import { sendPushToOwner } from '@/lib/push'
import { today } from '@/lib/utils'

/**
 * POST /api/mensagens/entrada/email — webhook `email.received` do Resend.
 *
 * Pública (o Resend não tem sessão), autenticada pela assinatura Svix com
 * `RESEND_WEBHOOK_SECRET`. A conversa vem do endereço de resposta assinado
 * (`r+<reserva>.<assinatura>@…`); sem ele, tenta-se o remetente, mas só se for
 * hóspede de um único anfitrião.
 *
 * Responde 200 a tudo o que não deve ser repetido (email sem dono, duplicado):
 * um 4xx/5xx faz o Resend tentar outra vez durante horas.
 */

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'
  const rl = await verificarLimite(`entrada-email:${ip}`, 120, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })

  const corpo = await req.text()
  const evento = verificarEmailRecebido(corpo, {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  })
  if (!evento) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })

  const supabase = createAdminClient()
  const remetente = enderecoEmail(evento.from)
  if (!remetente) return NextResponse.json({ ignorado: 'remetente inválido' })

  // Dono e reserva: primeiro pelo endereço assinado, depois pelo remetente.
  let ownerId: string | null = null
  let reservaId: string | null = null
  let hospedeId: string | null = null
  for (const para of evento.to) {
    const id = reservaDoEndereco(enderecoEmail(para) ?? '')
    if (!id) continue
    const { data } = await supabase.from('bookings').select('id, owner_id, hospede_id').eq('id', id).maybeSingle()
    if (data?.owner_id) {
      ownerId = data.owner_id
      reservaId = data.id
      hospedeId = data.hospede_id
      break
    }
  }
  if (!ownerId) {
    const r = await reservaDoEmail(supabase, remetente, today())
    if (!r) {
      console.warn('[entrada-email] sem dono para', evento.email_id)
      return NextResponse.json({ ignorado: 'sem dono' })
    }
    ownerId = r.owner_id
    reservaId = r.reserva_id
    hospedeId = r.hospede_id
  }

  const email = await lerEmailRecebido(evento.email_id)
  // Sem corpo não se grava — o Resend volta a tentar e pode ler-se depois.
  if (!email) return NextResponse.json({ error: 'Corpo indisponível.' }, { status: 503 })

  const texto = limparRespostaEmail(email.text ?? htmlParaTexto(email.html ?? '')).slice(0, LIMITE_CORPO)
  if (!texto) return NextResponse.json({ ignorado: 'vazio' })

  const r = await gravarMensagem(supabase, {
    owner_id: ownerId,
    reserva_id: reservaId,
    hospede_id: hospedeId,
    canal: 'email',
    direcao: 'entrada',
    estado: 'recebida',
    assunto: (email.subject || '').slice(0, LIMITE_ASSUNTO) || null,
    corpo: texto,
    contacto: remetente,
    nome_contacto: nomeDoRemetente(email.from),
    id_externo: email.id,
  })
  if (!r.ok) {
    console.error('[entrada-email] gravação falhou', r.erro)
    return NextResponse.json({ error: 'Falha ao gravar.' }, { status: 500 })
  }
  if (!r.duplicada) {
    await sendPushToOwner(ownerId, {
      title: `Nova mensagem de ${nomeDoRemetente(email.from) ?? remetente}`,
      body: texto.slice(0, 120),
      url: reservaId ? `/mensagens?reserva=${reservaId}` : '/mensagens',
    })
  }
  return NextResponse.json({ ok: true })
}
