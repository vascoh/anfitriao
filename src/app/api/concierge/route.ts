import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const client = new Anthropic()

const LANG_NAMES: Record<string, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  profissional: 'Use a professional, courteous tone.',
  amigavel: 'Use a warm, friendly and welcoming tone.',
  formal: 'Use a formal, polite and respectful tone.',
}

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const ip = getClientIp(req)
  const rl = checkRateLimit(`concierge:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Aguarda um momento.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const body = await req.json()
  const { message, targetLang, tone, context } = body

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Mensagem em falta' }), { status: 400 })
  }

  const langName = LANG_NAMES[targetLang] ?? 'English'
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.amigavel

  let contextBlock = ''
  if (context) {
    contextBlock = `
Property context:
- Name: ${context.propertyName}
- City: ${context.city}
${context.checkinInstructions ? `- Check-in instructions: ${context.checkinInstructions}` : ''}
${context.houseRules ? `- House rules: ${context.houseRules}` : ''}
${context.amenities?.length ? `- Amenities: ${context.amenities.join(', ')}` : ''}

Use this context to give accurate, specific answers when relevant.
`
  }

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant for a Portuguese vacation rental host (Alojamento Local).
${contextBlock}
A guest sent the following message:
"""
${message}
"""

Write a reply in ${langName}. ${toneInstruction} Be concise and helpful. Reply only with the message text — no quotes, no explanation, no subject line.`,
      },
    ],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
