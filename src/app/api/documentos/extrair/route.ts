import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase'
import { janelaDeCheckin } from '@/lib/checkin-acesso'
import { today } from '@/lib/utils'

const client = new Anthropic()

/**
 * A leitura do documento é feita por um modelo pago e a rota é pública — tem
 * de o ser, é o hóspede que fotografa o documento no telemóvel dele.
 *
 * "Pública" não pode querer dizer "aberta a toda a gente": sem prova nenhuma
 * de que quem chama tem alguma coisa a ver com uma reserva, qualquer pessoa
 * na internet podia gastar o orçamento de IA da conta, e o limitador por IP é
 * em memória (não funciona em serverless). Passa a ser preciso **um dos
 * dois**: sessão de anfitrião, ou o id de uma reserva com o check-in aberto —
 * um UUID que só quem recebeu o link tem.
 */
async function podeUsarOcr(req: NextRequest, bookingId: string | null): Promise<boolean> {
  const { userId } = await auth()
  if (userId) return true
  if (!bookingId) return false

  const { data } = await createAdminClient()
    .from('bookings')
    .select('check_out, estado')
    .eq('id', bookingId)
    .maybeSingle()

  if (!data || data.estado === 'cancelada') return false
  return janelaDeCheckin({
    jaSubmetido: false,
    checkOut: data.check_out as string,
    hoje: today(),
  }).mostraDados
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  /* 20/hora por IP.
   *
   * Era 5, pensado para um hóspede a fotografar um documento. Com o boletim
   * por pessoa, um grupo de 8 faz 8 leituras a partir do mesmo telemóvel e da
   * mesma rede — batia na parede à sexta pessoa, a meio do check-in, sem
   * explicação que fizesse sentido para quem está do outro lado.
   *
   * 20 cobre um grupo grande com repetições e continua a limitar o custo de
   * IA. ⚠️ Este limitador é em memória e não funciona em serverless (ver
   * DOSSIE §3, S2) — o teto real só existe depois do Upstash. */
  const rl = checkRateLimit(`documentos:${ip}`, 20, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const bookingId = typeof form.get('bookingId') === 'string' ? String(form.get('bookingId')) : null

    if (!(await podeUsarOcr(req, bookingId))) {
      return NextResponse.json(
        { error: 'Leitura de documento indisponível para esta reserva.' },
        { status: 403 },
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 8MB)' }, { status: 413 })
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type MediaType = (typeof ALLOWED_TYPES)[number]
    const mediaType: MediaType = (ALLOWED_TYPES as readonly string[]).includes(file.type)
      ? (file.type as MediaType)
      : 'image/jpeg'

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Extract identity document data from this image for Portuguese SIBA/SEF registration.

Return ONLY a JSON object with these keys (use null if not visible):
{
  "nome": full name,
  "data_nascimento": date of birth (DD/MM/YYYY),
  "nacionalidade": nationality in Portuguese,
  "numero_documento": document number,
  "tipo_documento": "Passaporte" | "Cartão de Cidadão" | "BI" | "Outro",
  "data_validade": expiry date (DD/MM/YYYY),
  "sexo": "M" | "F",
  "pais_emissao": issuing country in Portuguese
}

Return only the JSON object, no explanation.`,
            },
          ],
        },
      ],
    })

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '{}'

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== null && v !== '')
    )

    return NextResponse.json(cleaned)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
