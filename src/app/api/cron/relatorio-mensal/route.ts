import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { reservarEnvio, libertarEnvio, chaveDeEnvio } from '@/lib/envio-unico'
import { today, fmtMoney } from '@/lib/utils'
import { resumoMensal, mesAnterior, variacaoPct, nomeMes } from '@/lib/relatorio-mensal'
import { SOURCE_LABEL } from '@/lib/labels'
import { carregarTudo } from '@/lib/supabase-tudo'
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

  /* Duas correções na mesma leitura, pela mesma razão.
   *
   * **Paginar:** isto lia `bookings` de **todos** os anfitriões sem `range`, e
   * o PostgREST corta a 1000 linhas sem dizer nada. Assim que a plataforma
   * passar de mil reservas no total, o relatório do mês deixa de ver parte
   * delas — e não falha: envia. Cada anfitrião recebe um email com receita,
   * noites e ocupação a menos, com ar de estarem certos, e quem os lê não tem
   * como desconfiar. É o mesmo corte que já mordeu o calendário.
   *
   * **Estreitar:** só interessam dois meses — o do relatório e o anterior, com
   * que se calcula a variação. Trazer o histórico inteiro de toda a gente para
   * memória a cada dia 1 era, além do corte, um problema que só cresce.
   *
   * A janela apanha reservas que **atravessam** os meses e não só as que
   * começam neles: `occupancyForMonth` conta as noites que caem dentro do mês,
   * portanto uma estadia de 28 de junho a 3 de julho conta para os dois. */
  const inicioJanela = `${anterior.ano}-${String(anterior.mes + 1).padStart(2, '0')}-01`
  const fimJanela = mes === 11
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mes + 2).padStart(2, '0')}-01`

  const [
    { linhas: props, erro: errProps },
    { linhas: bookings, erro: errBookings },
  ] = await Promise.all([
    carregarTudo<Property>(() =>
      supabase.from('properties').select('*').not('owner_id', 'is', null)
        .order('id', { ascending: true })),
    carregarTudo<Booking>(() =>
      supabase.from('bookings').select('*')
        .not('owner_id', 'is', null)
        .gte('check_out', inicioJanela)
        .lte('check_in', fimJanela)
        .order('id', { ascending: true })),
  ])

  if (errProps || errBookings) {
    const msg = errProps ?? errBookings ?? 'erro'
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

    /* Um relatório por anfitrião por mês. Duas execuções no dia 1 mandavam
     * dois relatórios iguais. */
    const chave = chaveDeEnvio('relatorio', ownerId, `${ano}-${String(mes).padStart(2, '0')}`)
    if (!await reservarEnvio(chave)) continue

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
    else await libertarEnvio(chave)
  }

  return NextResponse.json({ ok: true, mes: mesLabel, enviados })
}
