import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { today, fmtMoney } from '@/lib/utils'
import { resumoMensal, mesAnterior, variacaoPct, nomeMes } from '@/lib/relatorio-mensal'
import { SOURCE_LABEL } from '@/lib/labels'
import type { Booking, Property, BookingSource } from '@/lib/types'

const supabase = createAdminClient()

/**
 * Cron: resumo mensal por email, no dia 1 às 08:00 (ver vercel.json).
 * Cobre sempre o mês **anterior** — no dia 1 de agosto envia julho.
 *
 * Cálculo em `lib/relatorio-mensal.ts`, testado sem base de dados.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const { ano, mes } = mesAnterior(today())
  const anterior = mesAnterior(`${ano}-${String(mes + 1).padStart(2, '0')}-01`)

  const [{ data: props, error: errProps }, { data: bookings, error: errBookings }] = await Promise.all([
    supabase.from('properties').select('*').not('owner_id', 'is', null),
    supabase.from('bookings').select('*').not('owner_id', 'is', null),
  ])

  if (errProps || errBookings) {
    const msg = errProps?.message ?? errBookings?.message ?? 'erro'
    console.error('[relatorio-mensal]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Agrupar por anfitrião
  const propsPor = new Map<string, Property[]>()
  for (const p of (props ?? []) as Property[]) {
    if (!p.owner_id) continue
    propsPor.set(p.owner_id, [...(propsPor.get(p.owner_id) ?? []), p])
  }

  const bookingsPor = new Map<string, Booking[]>()
  for (const b of (bookings ?? []) as Booking[]) {
    if (!b.owner_id) continue
    bookingsPor.set(b.owner_id, [...(bookingsPor.get(b.owner_id) ?? []), b])
  }

  const ownerIds = [...propsPor.keys()]
  if (ownerIds.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  const { data: contas } = await supabase
    .from('accounts')
    .select('clerk_user_id, email, nome')
    .in('clerk_user_id', ownerIds)

  let enviados = 0
  const mesLabel = `${nomeMes(mes)} de ${ano}`

  for (const conta of contas ?? []) {
    const ownerId = conta.clerk_user_id
    if (!conta.email) continue

    const minhasProps = propsPor.get(ownerId) ?? []
    const minhasBookings = bookingsPor.get(ownerId) ?? []
    if (minhasProps.length === 0) continue

    const r = resumoMensal(minhasBookings, minhasProps, ano, mes)

    // Conta sem atividade nenhuma no mês: não vale um email
    if (r.reservas === 0 && r.receita === 0) continue

    const rAnterior = resumoMensal(minhasBookings, minhasProps, anterior.ano, anterior.mes)
    const varReceita = variacaoPct(r.receita, rAnterior.receita)

    const metricas: Array<[string, string]> = [
      ['Reservas', String(r.reservas)],
      ['Noites vendidas', `${r.noites} de ${r.noitesDisponiveis}`],
      ['Taxa de ocupação', `${r.ocupacaoPct}%`],
      ['Preço médio por noite', fmtMoney(r.adr)],
      ['RevPAR', fmtMoney(r.revpar)],
      ['Receita total', fmtMoney(r.receita)],
    ]

    const porOrigem: Array<[string, string]> = r.porOrigem.map(o => [
      SOURCE_LABEL[o.origem as BookingSource] ?? o.origem,
      fmtMoney(o.valor),
    ])

    const res = await emailService.sendRelatorioMensal({
      to: conta.email,
      firstName: conta.nome?.split(' ')[0] ?? 'Olá',
      mesLabel,
      destaque: `${fmtMoney(r.receita)} em ${nomeMes(mes)}`,
      variacao: varReceita === null
        ? null
        : varReceita >= 0
          ? `mais ${varReceita}% do que no mês anterior`
          : `menos ${Math.abs(varReceita)}% do que no mês anterior`,
      metricas,
      porOrigem,
    })
    if (res.ok) enviados++
  }

  return NextResponse.json({ ok: true, mes: mesLabel, enviados })
}
