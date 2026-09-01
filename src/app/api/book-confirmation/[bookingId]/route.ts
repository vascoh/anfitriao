import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/rate-limit'
import { verificarLimite } from '@/lib/rate-limit-persistente'

const supabase = createAdminClient()

/**
 * Resumo público de uma reserva para a página de confirmação (/book/[id]/confirmacao).
 * bookingId funciona como capability URL (UUID não adivinhável) — mesmo padrão
 * de /api/checkin/[bookingId]. Substitui leituras anon diretas às tabelas
 * bookings/properties/website_settings (removidas por exporem dados de todos
 * os inquilinos, não só desta reserva — ver docs/SAAS_ARCHITECTURE.md §10).
 * Só devolve os campos que a página de confirmação precisa, nunca `notas` nem
 * dados de outros hóspedes/reservas.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const ip = getClientIp(req)
  // Na base, como o `/api/checkin/[bookingId]` cujo padrão de capability URL
  // esta rota segue: devolve datas, número de hóspedes e preço de uma reserva
  // sem sessão. Mesma classe de dados, mesmo limitador.
  const rl = await verificarLimite(`book-confirmation:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  }

  const { bookingId } = await params

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, propriedade_id, check_in, check_out, num_hospedes, preco_total, owner_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })

  const [{ data: prop }, { data: settings }] = await Promise.all([
    supabase.from('properties').select('nome, imagem_url, cor').eq('id', booking.propriedade_id).maybeSingle(),
    booking.owner_id
      ? supabase.from('website_settings').select('email, telefone, slug').eq('owner_id', booking.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    booking: {
      check_in: booking.check_in,
      check_out: booking.check_out,
      num_hospedes: booking.num_hospedes,
      preco_total: booking.preco_total,
    },
    property: prop ? { nome: prop.nome, imagem_url: prop.imagem_url, cor: prop.cor } : null,
    settings: settings ? { email: settings.email, telefone: settings.telefone, slug: settings.slug } : null,
  })
}
