import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkCronAuth } from '@/lib/cron-auth'
import { emailService } from '@/lib/email'
import { reservarEnvio, libertarEnvio, chaveDeEnvio } from '@/lib/envio-unico'
import { sendPushToOwner } from '@/lib/push'
import { today } from '@/lib/utils'
import { avaliarConformidade, itensParaAlertar } from '@/lib/compliance'

const supabase = createAdminClient()

/**
 * Cron: avisa o anfitrião quando documentos legais estão a expirar ou já
 * expiraram (ANF-4.3). Disparado diariamente às 09:30 (ver vercel.json).
 *
 * Os marcos de alerta vivem em `lib/compliance.ts` (`deveAlertar`), para a
 * regra ser testável sem base de dados. Aqui só se recolhe, agrupa por
 * anfitrião e envia — um email por anfitrião, nunca um por alojamento.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const hoje = today()

  // Só alojamentos ativos e com dono: sem owner_id não há a quem notificar.
  const { data: propriedades, error } = await supabase
    .from('properties')
    .select('id, nome, owner_id, ativo, rnal_numero, seguro_seguradora, seguro_apolice, seguro_validade, livro_reclamacoes_registado, certificado_energetico_validade')
    .not('owner_id', 'is', null)

  if (error) {
    console.error('[compliance-alerts]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // owner_id → linhas para a tabela do email
  const porAnfitriao = new Map<string, { linhas: Array<[string, string]>; temExpirado: boolean }>()

  for (const p of propriedades ?? []) {
    if (p.ativo === false) continue

    const alertas = itensParaAlertar(avaliarConformidade(p, hoje))
    if (alertas.length === 0) continue

    const entrada = porAnfitriao.get(p.owner_id!) ?? { linhas: [], temExpirado: false }
    for (const item of alertas) {
      entrada.linhas.push([`${p.nome} · ${item.titulo}`, item.detalhe])
      if (item.estado === 'expirado') entrada.temExpirado = true
    }
    porAnfitriao.set(p.owner_id!, entrada)
  }

  if (porAnfitriao.size === 0) {
    return NextResponse.json({ ok: true, notificados: 0 })
  }

  // Email da conta (o push não precisa dele, mas o email sim)
  const { data: contas } = await supabase
    .from('accounts')
    .select('clerk_user_id, email, nome')
    .in('clerk_user_id', [...porAnfitriao.keys()])

  const porId = new Map((contas ?? []).map(c => [c.clerk_user_id, c]))

  let emails = 0
  let pushes = 0

  for (const [ownerId, { linhas, temExpirado }] of porAnfitriao) {
    // Push primeiro: é independente do Resend e chega ao telemóvel
    pushes += await sendPushToOwner(ownerId, {
      title: temExpirado ? 'Documentos expirados' : 'Documentos a expirar',
      body: linhas.length === 1
        ? linhas[0][0]
        : `${linhas.length} itens precisam de atenção no teu Alojamento Local.`,
      url: '/conformidade',
    })

    const conta = porId.get(ownerId)
    if (!conta?.email) continue

    /* Um alerta por anfitrião por dia. Os marcos já limitam o email a dias
     * certos; o que faltava era a garantia de que **duas execuções no mesmo
     * dia** não o mandam duas vezes. */
    const chave = chaveDeEnvio('conformidade', ownerId, hoje)
    if (!await reservarEnvio(chave)) continue

    const res = await emailService.sendComplianceAlert({
      to: conta.email,
      firstName: conta.nome?.split(' ')[0] ?? 'Olá',
      linhas,
      temExpirado,
    })
    if (res.ok) emails++ // um email falhado não pode abortar o cron
    else await libertarEnvio(chave)
  }

  return NextResponse.json({ ok: true, notificados: porAnfitriao.size, emails, pushes })
}
