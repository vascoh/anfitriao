import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { verificarLimite } from '@/lib/rate-limit-persistente'

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
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Rate limit: 20 requests per minute per user
  const rl = await verificarLimite(`concierge:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Aguarda um momento.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { message, targetLang, tone, context } = body as Record<string, unknown>

  const msg = typeof message === 'string' ? message.trim().slice(0, 4000) : ''
  if (!msg) {
    return NextResponse.json({ error: 'Mensagem em falta' }, { status: 400 })
  }

  // 'auto' responde no idioma da mensagem do hóspede
  const langInstruction =
    targetLang === 'auto' || !LANG_NAMES[targetLang as string]
      ? "Write a reply in the same language as the guest's message."
      : `Write a reply in ${LANG_NAMES[targetLang as string]}.`
  const toneInstruction = TONE_INSTRUCTIONS[tone as string] ?? TONE_INSTRUCTIONS.amigavel

  const clamp = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  let contextBlock = ''
  if (context && typeof context === 'object') {
    const c = context as Record<string, unknown>
    const amenities = Array.isArray(c.amenities) ? c.amenities.filter(a => typeof a === 'string').slice(0, 40) : []
    contextBlock = `
Property context:
- Name: ${clamp(c.propertyName, 200)}
- City: ${clamp(c.city, 100)}
${c.checkinInstructions ? `- Check-in instructions: ${clamp(c.checkinInstructions, 2000)}` : ''}
${c.houseRules ? `- House rules: ${clamp(c.houseRules, 2000)}` : ''}
${amenities.length ? `- Amenities: ${amenities.join(', ')}` : ''}

Use this context to give accurate, specific answers when relevant.
`
  }

  /* Se o hóspede fechar o separador, não há motivo para continuar a pagar
   * tokens de uma resposta que ninguém vai ler. */
  const stream = client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant for a Portuguese vacation rental host (Alojamento Local).
${contextBlock}
A guest sent the following message:
"""
${msg}
"""

${langInstruction} ${toneInstruction} Be concise and helpful. Reply only with the message text — no quotes, no explanation, no subject line.`,
      },
    ],
  }, { signal: req.signal })

  const readable = new ReadableStream({
    async start(controller) {
      let entrada = 0
      let saida = 0
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'message_start') entrada = chunk.message.usage.input_tokens
          if (chunk.type === 'message_delta') saida = chunk.usage.output_tokens
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        /* Antes fechava-se o `controller` no `finally`, o que dava ao
         * anfitrião uma resposta **truncada com ar de completa**: meia frase,
         * sem erro nenhum, e ele a copiá-la para o hóspede. Falhar é melhor
         * do que mentir a meio. */
        if (req.signal.aborted) {
          controller.close()
          return
        }
        console.error('[concierge] stream interrompido', userId, err)
        controller.error(err)
      } finally {
        // Custo de IA atribuível por conta, que é o mínimo antes de haver
        // teto por conta (ANF-11.1). Sai nos logs, não na base de dados.
        console.info('[concierge] uso', JSON.stringify({ userId, entrada, saida }))
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
