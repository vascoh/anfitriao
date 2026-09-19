import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { reservarEnvio, libertarEnvio, chaveDeEnvio } from '@/lib/envio-unico'
import { sendPushToOwner } from '@/lib/push'
import { today } from '@/lib/utils'
import { canaisEmRisco, agruparPorAnfitriao, resumoParaPush } from '@/lib/canais-alertas'
import { carregarTudo } from '@/lib/supabase-tudo'
import type { AlojamentoComFeeds } from '@/lib/canais-alertas'

const supabase = createAdminClient()

/**
 * Cron: avisa o anfitrião quando um calendário deixou de ser lido.
 *
 * Corre às 06:00, duas horas depois da sincronização das 04:00 — o alerta é
 * sobre o que essa passagem não conseguiu ler, portanto tem de vir depois
 * dela e não antes.
 *
 * A razão de existir está em `lib/canais-alertas.ts`: o crachá em `/canais` já
 * dizia isto, mas ninguém abre `/canais`. E desde que a disponibilidade passou
 * a ser confirmada ao vivo antes de aceitar uma reserva, um feed partido
 * deixou de ser uma vista desatualizada e passou a **recusar reservas
 * diretas** — um custo que o anfitrião não vê acontecer.
 *
 * A regra de quem é avisado vive na lib, para ser testável sem base de dados.
 * Aqui só se recolhe, agrupa por anfitrião e envia.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  /* Paginado: este cron tem de ver os alojamentos **todos**. O PostgREST corta
   * a 1000 linhas sem erro nenhum (ver `lib/supabase-tudo.ts`), e o que se
   * perdia aqui não era uma vista incompleta — era o anfitrião do alojamento
   * 1001 a nunca saber que o calendário dele deixou de ser lido, e portanto
   * que as reservas diretas estão a ser recusadas. O cron responderia `ok`. */
  const { linhas: propriedades, erro } = await carregarTudo<AlojamentoComFeeds>(() =>
    supabase
      .from('properties')
      .select('nome, owner_id, ativo, ical_feeds')
      .not('owner_id', 'is', null)
      .order('id', { ascending: true }))

  if (erro) {
    console.error('[canais-alertas]', erro)
    return NextResponse.json({ error: erro }, { status: 500 })
  }

  const riscos = canaisEmRisco(propriedades)
  const porAnfitriao = agruparPorAnfitriao(riscos)

  if (porAnfitriao.size === 0) {
    return NextResponse.json({ ok: true, notificados: 0 })
  }

  const { data: contas } = await supabase
    .from('accounts')
    .select('clerk_user_id, email, nome')
    .in('clerk_user_id', [...porAnfitriao.keys()])

  const porId = new Map((contas ?? []).map(c => [c.clerk_user_id, c]))
  const hoje = today()

  let emails = 0
  let pushes = 0

  for (const [ownerId, doAnfitriao] of porAnfitriao) {
    // Push primeiro: é independente do Resend e chega ao telemóvel.
    pushes += await sendPushToOwner(ownerId, { ...resumoParaPush(doAnfitriao), url: '/canais' })

    const conta = porId.get(ownerId)
    if (!conta?.email) continue

    /* Um aviso por anfitrião por dia. Um alerta repetido ensina-o a ignorar
     * todos os outros — ver `lib/envio-unico.ts`. */
    const chave = chaveDeEnvio('canais', ownerId, hoje)
    if (!await reservarEnvio(chave)) continue

    const res = await emailService.sendCanaisEmRisco({
      to: conta.email,
      firstName: conta.nome?.split(' ')[0] ?? 'Olá',
      linhas: doAnfitriao.map(r => [r.onde, r.porque] as [string, string]),
      temErro: doAnfitriao.some(r => r.estado === 'erro'),
    })

    if (res.ok) emails++ // um email falhado não pode abortar o cron
    else await libertarEnvio(chave)
  }

  return NextResponse.json({ ok: true, notificados: porAnfitriao.size, emails, pushes })
}
