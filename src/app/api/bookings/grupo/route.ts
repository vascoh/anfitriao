import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import {
  quartosDaCasa, disponibilidadeDosQuartos, capacidadeTotal, distribuirPessoas,
} from '@/lib/grupos'
import { calculatePriceWithRules } from '@/lib/reservations'
import type { Booking, Property, PriceRule, Tarifa, PlatformRate, BookingSource } from '@/lib/types'

const supabase = createAdminClient()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/bookings/grupo — reserva uma casa inteira de uma vez.
 *
 * Cria uma reserva por quarto, todas com o mesmo `reserva_grupo_id`.
 *
 * **Ou entram todas, ou não entra nenhuma.** Os quartos são verificados aqui,
 * no servidor, imediatamente antes de escrever, e o insert é uma só instrução
 * — o que fecha a janela em que o cliente viu tudo livre e, entretanto, uma
 * reserva do Airbnb chegou por iCal e ficou com um quarto. Meio grupo alojado
 * é pior do que grupo nenhum: o anfitrião só descobre à chegada.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rl = checkRateLimit(`grupo:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarda um momento.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as {
    casaId?: string
    checkIn?: string
    checkOut?: string
    numHospedes?: number
    hospedeId?: string | null
    quartoIds?: string[]
    origem?: BookingSource
    estado?: Booking['estado']
    notas?: string
    precoTotal?: number
  } | null

  const casaId = body?.casaId
  const checkIn = body?.checkIn
  const checkOut = body?.checkOut
  const numHospedes = Number(body?.numHospedes ?? 0)

  if (!casaId || !checkIn || !checkOut || !DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) {
    return NextResponse.json({ error: 'Alojamento e datas são obrigatórios.' }, { status: 400 })
  }
  if (checkIn >= checkOut) {
    return NextResponse.json({ error: 'A saída tem de ser depois da entrada.' }, { status: 400 })
  }
  if (!Number.isInteger(numHospedes) || numHospedes < 1 || numHospedes > 100) {
    return NextResponse.json({ error: 'Número de hóspedes inválido.' }, { status: 400 })
  }

  // Propriedades do anfitrião — o filtro por owner é o que impede reservar a
  // casa de outra pessoa.
  const { data: props } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', userId)

  const propriedades = (props ?? []) as Property[]
  const casa = propriedades.find(p => p.id === casaId)
  if (!casa) return NextResponse.json({ error: 'Alojamento não encontrado.' }, { status: 404 })

  const quartos = quartosDaCasa(propriedades, casaId)
  if (quartos.length === 0) {
    return NextResponse.json(
      { error: 'Este alojamento não tem quartos — reserva-o diretamente.' },
      { status: 400 },
    )
  }

  // Quartos pedidos, ou todos os que a casa tem.
  const pedidos = body?.quartoIds?.length
    ? quartos.filter(q => body.quartoIds!.includes(q.id))
    : quartos

  if (pedidos.length === 0) {
    return NextResponse.json({ error: 'Nenhum dos quartos indicados pertence a este alojamento.' }, { status: 400 })
  }

  const capacidade = capacidadeTotal(pedidos)
  if (numHospedes > capacidade) {
    return NextResponse.json(
      {
        error: `Não cabem: os quartos escolhidos levam ${capacidade} ${capacidade === 1 ? 'pessoa' : 'pessoas'} e são ${numHospedes}.`,
        code: 'SEM_CAPACIDADE',
        capacidade,
      },
      { status: 400 },
    )
  }

  // Verificação de conflitos imediatamente antes de escrever.
  const { data: existentes } = await supabase
    .from('bookings')
    .select('id, propriedade_id, check_in, check_out, estado')
    .eq('owner_id', userId)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)

  const bookingsExistentes = (existentes ?? []) as Booking[]
  const disponibilidade = disponibilidadeDosQuartos(pedidos, bookingsExistentes, checkIn, checkOut)
  const ocupados = disponibilidade.filter(d => !d.livre)

  if (ocupados.length > 0) {
    return NextResponse.json(
      {
        error: `Já não está livre: ${ocupados.map(o => o.quarto.nome).join(', ')}.`,
        code: 'CONFLITO',
        quartos: ocupados.map(o => ({ id: o.quarto.id, nome: o.quarto.nome })),
      },
      { status: 409 },
    )
  }

  // Preço por quarto, com as regras de cada um. Um preço global dividido por
  // quartos daria números errados no relatório por alojamento.
  const [{ data: rules }, { data: tarifas }, { data: rates }] = await Promise.all([
    supabase.from('price_rules').select('*').eq('owner_id', userId),
    supabase.from('tarifas').select('*').eq('owner_id', userId),
    supabase.from('platform_rates').select('*').eq('owner_id', userId),
  ])

  const origem: BookingSource = body?.origem ?? 'direto'
  const pessoasPorQuarto = distribuirPessoas(pedidos, numHospedes)
  const grupoId = crypto.randomUUID()
  const agora = new Date().toISOString()

  const precos = pedidos.map(q =>
    calculatePriceWithRules(
      q, checkIn, checkOut,
      (rules ?? []) as PriceRule[],
      (tarifas ?? []) as Tarifa[],
      (rates ?? []) as PlatformRate[],
      origem,
    ).total,
  )

  const somaCalculada = precos.reduce((s, p) => s + p, 0)
  /* Se o anfitrião fixou um total para o grupo — um desconto de casa inteira,
     tipicamente — reparte-se pelos quartos na proporção do preço de cada um,
     para o relatório por alojamento continuar a fazer sentido. */
  const fator = body?.precoTotal && somaCalculada > 0 ? body.precoTotal / somaCalculada : 1

  const linhas = pedidos.map((q, i) => ({
    id: crypto.randomUUID(),
    propriedade_id: q.id,
    hospede_id: body?.hospedeId ?? null,
    check_in: checkIn,
    check_out: checkOut,
    num_hospedes: pessoasPorQuarto.get(q.id) ?? 0,
    estado: body?.estado ?? 'confirmada',
    origem,
    preco_total: Math.round(precos[i] * fator * 100) / 100,
    preco_pago: 0,
    notas: body?.notas ?? null,
    criado_em: agora,
    historico: [{
      id: crypto.randomUUID(),
      data: agora,
      tipo: 'criada',
      descricao: `Reserva de grupo em ${casa.nome} — ${pedidos.length} quartos, ${numHospedes} ${numHospedes === 1 ? 'pessoa' : 'pessoas'}`,
    }],
    owner_id: userId,
    reserva_grupo_id: grupoId,
  }))

  const { error } = await supabase.from('bookings').insert(linhas)
  if (error) {
    console.error('[POST /api/bookings/grupo]', error.message)
    return NextResponse.json({ error: 'Erro ao criar a reserva de grupo.' }, { status: 500 })
  }

  await logAudit({
    actorId: userId,
    entidade: 'booking',
    entidadeId: grupoId,
    acao: 'grupo_criado',
    detalhes: {
      casa: casa.nome,
      quartos: pedidos.map(q => q.nome),
      hospedes: numHospedes,
      total: Math.round(somaCalculada * fator * 100) / 100,
    },
  })

  return NextResponse.json({
    grupoId,
    reservas: linhas.map(l => ({ id: l.id, propriedade_id: l.propriedade_id, preco_total: l.preco_total })),
    total: Math.round(somaCalculada * fator * 100) / 100,
  })
}

/**
 * DELETE /api/bookings/grupo?id=… — cancela o grupo inteiro.
 *
 * Cancelar quarto a quarto deixaria o grupo meio cancelado, que é um estado
 * que não quer dizer nada para ninguém.
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const grupoId = req.nextUrl.searchParams.get('id')
  if (!grupoId) return NextResponse.json({ error: 'id do grupo em falta' }, { status: 400 })

  const { data, error } = await supabase
    .from('bookings')
    .update({ estado: 'cancelada' })
    .eq('owner_id', userId)
    .eq('reserva_grupo_id', grupoId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 })
  }

  await logAudit({
    actorId: userId,
    entidade: 'booking',
    entidadeId: grupoId,
    acao: 'grupo_cancelado',
    detalhes: { reservas: data.length },
  })

  return NextResponse.json({ canceladas: data.length })
}
