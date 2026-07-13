import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`documentos:${ip}`, 5, 3_600_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null

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
