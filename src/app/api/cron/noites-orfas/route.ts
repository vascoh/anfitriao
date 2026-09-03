import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { carregarTudo } from '@/lib/supabase-tudo'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { reservarEnvio, libertarEnvio, chaveDeEnvio } from '@/lib/envio-unico'
import { sendPushToOwner } from '@/lib/push'
import { today, fmtDate } from '@/lib/utils'
import { detetarNoitesOrfas, descontoSugerido, HORIZONTE_DIAS } from '@/lib/noites-orfas'
import { addDays } from '@/lib/reservations'
import type { Booking } from '@/lib/types'

const supabase = createAdminClient()

/**
 * Cron: deteta buracos curtos no calendário e sugere desconto (ANF-6.2).
 * Semanal, à segunda às 11:00 (ver vercel.json) — semanal e não diário porque
 * o calendário não muda tanto ao ponto de justificar um email por dia, e
 * porque a mesma noite órfã seria repetida vezes sem conta.
 *
 * A lógica de deteção vive em `lib/noites-orfas.ts` e é testada sem BD.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const hoje = today()
  const limite = addDays(hoje, HORIZONTE_DIAS)

  const { data: propriedades, error: errProps } = await supabase
    .from('properties')
    .select('id, nome, owner_id, ativo, preco_base')
    .not('owner_id', 'is', null)

  if (errProps) {
    console.error('[noites-orfas]', errProps.message)
    return NextResponse.json({ error: errProps.message }, { status: 500 })
  }

  const ativas = (propriedades ?? []).filter(p => p.ativo !== false)
  if (ativas.length === 0) return NextResponse.json({ ok: true, notificados: 0 })

  // Só as reservas que podem formar buracos dentro do horizonte
  /* Paginado, e o erro corta a execução.
   *
   * Esta lista é o que diz quais noites estão ocupadas. Uma reserva que não
   * venha na resposta transforma-se num buraco no calendário — e este cron
   * manda um email a sugerir que se venda essa noite com desconto. Sugerir a
   * venda de uma noite já vendida é a dupla reserva a chegar por email, com o
   * nosso nome. */
  const { linhas: bookings, erro: errBookings } = await carregarTudo<
    Pick<Booking, 'id' | 'propriedade_id' | 'check_in' | 'check_out' | 'estado' | 'owner_id'>
  >(() =>
    supabase
      .from('bookings')
      .select('id, propriedade_id, check_in, check_out, estado, owner_id')
      .gte('check_out', hoje)
      .lte('check_in', limite)
      .order('id', { ascending: true }),
  )

  if (errBookings) {
    console.error('[noites-orfas]', errBookings)
    return NextResponse.json({ error: errBookings }, { status: 500 })
  }

  const todas = bookings as unknown as Booking[]
  const porAnfitriao = new Map<string, Array<[string, string]>>()

  for (const p of ativas) {
    const orfas = detetarNoitesOrfas(todas, p.id, hoje)
    if (orfas.length === 0) continue

    const linhas = porAnfitriao.get(p.owner_id!) ?? []
    for (const orfa of orfas) {
      const pct = descontoSugerido(orfa)
      const quando = orfa.noites === 1
        ? fmtDate(orfa.inicio, { day: 'numeric', month: 'short' })
        : `${fmtDate(orfa.inicio, { day: 'numeric', month: 'short' })} a ${fmtDate(orfa.fim, { day: 'numeric', month: 'short' })}`

      const precoSugerido = p.preco_base
        ? ` (${Math.round(p.preco_base * (1 - pct / 100))} €/noite)`
        : ''

      linhas.push([
        `${p.nome} · ${quando}`,
        `${orfa.noites} ${orfa.noites === 1 ? 'noite' : 'noites'} — baixar ${pct}%${precoSugerido}`,
      ])
    }
    porAnfitriao.set(p.owner_id!, linhas)
  }

  if (porAnfitriao.size === 0) return NextResponse.json({ ok: true, notificados: 0 })

  const { data: contas } = await supabase
    .from('accounts')
    .select('clerk_user_id, email, nome')
    .in('clerk_user_id', [...porAnfitriao.keys()])

  const porId = new Map((contas ?? []).map(c => [c.clerk_user_id, c]))

  let emails = 0
  let pushes = 0

  for (const [ownerId, linhas] of porAnfitriao) {
    pushes += await sendPushToOwner(ownerId, {
      title: linhas.length === 1 ? 'Noite por encher' : `${linhas.length} buracos no calendário`,
      body: linhas.length === 1 ? linhas[0][0] : 'Vê onde vale a pena baixar o preço.',
      url: '/calendario',
    })

    const conta = porId.get(ownerId)
    if (!conta?.email) continue

    // Uma sugestão por anfitrião por execução semanal.
    const chave = chaveDeEnvio('noites_orfas', ownerId, hoje)
    if (!await reservarEnvio(chave)) continue

    const res = await emailService.sendNoitesOrfas({
      to: conta.email,
      firstName: conta.nome?.split(' ')[0] ?? 'Olá',
      linhas,
    })
    if (res.ok) emails++
    else await libertarEnvio(chave)
  }

  return NextResponse.json({ ok: true, notificados: porAnfitriao.size, emails, pushes })
}
