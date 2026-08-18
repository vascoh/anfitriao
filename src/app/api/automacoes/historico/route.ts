import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * GET /api/automacoes/historico — quantas vezes cada automação já disparou.
 *
 * O `automation_log` era escrito pelo cron todas as noites e não era lido por
 * ninguém a não ser pelo próprio cron (para não repetir envios). O anfitrião
 * que quisesse saber se a mensagem das instruções de chegada tinha saído — a
 * pergunta que aparece quando um hóspede liga a dizer que não recebeu o código
 * — não tinha onde ver.
 *
 * A tabela não tem `owner_id`: a propriedade prova-se pela automação, por isso
 * carrega-se primeiro as do anfitrião e só depois o que lhes diz respeito.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: automacoes } = await supabase
    .from('automations')
    .select('id')
    .eq('owner_id', userId)

  const ids = (automacoes ?? []).map(a => a.id as string)
  if (ids.length === 0) return NextResponse.json({})

  const { data: registos, error } = await supabase
    .from('automation_log')
    .select('automation_id, executado_em, resultado')
    .in('automation_id', ids)
    .order('executado_em', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const porAutomacao: Record<string, { enviados: number; ultimo: string | null }> = {}
  for (const id of ids) porAutomacao[id] = { enviados: 0, ultimo: null }

  for (const r of registos ?? []) {
    const alvo = porAutomacao[r.automation_id as string]
    if (!alvo) continue
    /* `coberta_pelo_grupo` conta como tratada, não como enviada: numa casa
     * alugada por inteiro sai um email só para as reservas todas, e contar
     * cada quarto faria o número parecer maior do que o que o hóspede viu. */
    if (r.resultado === 'enviado') alvo.enviados++
    if (!alvo.ultimo) alvo.ultimo = r.executado_em as string
  }

  return NextResponse.json(porAutomacao)
}
