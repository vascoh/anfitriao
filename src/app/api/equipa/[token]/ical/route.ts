import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { verificarLimite } from '@/lib/rate-limit-persistente'
import { getClientIp } from '@/lib/rate-limit'
import { carregarPlano, resolverAcesso } from '@/lib/limpezas-server'
import { generateIcal } from '@/lib/ical'
import { addDays, today } from '@/lib/utils'

/**
 * Calendário das limpezas, para a equipa subscrever no Google Calendar ou no
 * telemóvel. Um evento de dia inteiro por limpeza; o texto diz o quarto e se
 * entra alguém no mesmo dia. Nunca o nome do hóspede.
 */

/** O gerador de iCal não escapa texto: vírgulas, pontos e vírgulas e quebras partem o evento. */
function limpo(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/[\\;,]/g, ' ').trim()
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = await verificarLimite(`equipa:ical:${getClientIp(req)}`, 120, 3_600_000)
  if (!rl.allowed) return new NextResponse('Too many requests', { status: 429 })

  const { token } = await params
  const acesso = await resolverAcesso(token)
  if (!acesso) return new NextResponse('Not found', { status: 404 })

  const hoje = today()
  const { plano, erro } = await carregarPlano(acesso.owner_id, {
    de: addDays(hoje, -14), ate: addDays(hoje, 90), escolhidas: acesso.propriedade_ids,
  })
  if (erro) return new NextResponse('Erro', { status: 500 })

  const eventos = plano.limpezas.map(l => {
    const quarto = limpo(plano.unidades[l.propriedade_id]?.nome ?? 'Quarto')
    const extra = l.mesmoDia
      ? ` (entram ${l.entrada?.hospedes || '?'} hoje)`
      : l.incerta ? ' (confirmar)' : ''
    return {
      uid: createHash('sha256').update(`anfitriao-limpeza:${l.chave}`).digest('hex').slice(0, 32),
      summary: `${l.estado === 'feita' ? '✓ ' : ''}Limpeza · ${quarto}${extra}`,
      start: l.data,
      end: addDays(l.data, 1),
    }
  })

  return new NextResponse(generateIcal(eventos, `Limpezas · ${limpo(acesso.nome)}`), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
