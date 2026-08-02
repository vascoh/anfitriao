import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase'
import { emitirFaturaDaReserva } from '@/lib/faturacao/emitir'
import { today } from '@/lib/utils'

/**
 * Cron: emite as faturas das reservas que fizeram checkout.
 *
 * É isto que separa "podes faturar aqui" de "as tuas faturas estão feitas". O
 * anfitrião de AL não se esquece de faturar por preguiça — esquece-se porque
 * o checkout é ao domingo de manhã e a fatura é a última coisa em que pensa.
 *
 * Regras:
 * - Só contas com `emissao_automatica` e prontas (AT ligada e série criada).
 * - Só reservas com valor e não canceladas, com checkout já passado.
 * - Nunca reemite: `emitirFaturaDaReserva` recusa o que já foi emitido.
 * - Uma falha numa reserva não trava as outras: fica `fatura_estado=falhou`
 *   com o motivo, e aparece no painel para o anfitrião decidir.
 */

/** Teto por execução, para uma conta com histórico grande não esgotar a função. */
const MAX_POR_EXECUCAO = 200

export async function GET(req: NextRequest) {
  const naoAutorizado = checkCronAuth(req)
  if (naoAutorizado) return naoAutorizado

  const supabase = createAdminClient()
  const hoje = today()

  const { data: contas, error } = await supabase
    .from('faturacao_contas')
    .select('owner_id, at_estado, serie_id, estado, emissao_automatica')
    .eq('emissao_automatica', true)
    .eq('estado', 'ativa')
    .eq('at_estado', 'configurada')
    .not('serie_id', 'is', null)

  if (error) {
    console.error('[cron/faturacao]', error.message)
    return NextResponse.json({ error: 'Erro ao carregar contas' }, { status: 500 })
  }

  let emitidas = 0
  let falhadas = 0
  const porConta: Array<{ owner: string; emitidas: number; falhadas: number }> = []

  for (const conta of contas ?? []) {
    const { data: reservas } = await supabase
      .from('bookings')
      .select('id')
      .eq('owner_id', conta.owner_id)
      .eq('fatura_estado', 'nao_emitida')
      .lte('check_out', hoje)
      .gt('preco_total', 0)
      .not('estado', 'in', '("cancelada","no_show")')
      .order('check_out', { ascending: true })
      .limit(MAX_POR_EXECUCAO)

    let ok = 0
    let ko = 0

    for (const r of reservas ?? []) {
      const resultado = await emitirFaturaDaReserva(conta.owner_id, r.id)
      if (resultado.ok) {
        ok++
      } else {
        ko++
        // 'ja_emitida' e 'a_emitir' são corridas normais com o botão manual,
        // não erros — não vale a pena poluir os registos com elas.
        if (resultado.motivo !== 'ja_emitida' && resultado.motivo !== 'a_emitir') {
          console.error('[cron/faturacao]', r.id, resultado.motivo, resultado.erro)
        }
      }
    }

    emitidas += ok
    falhadas += ko
    if (ok > 0 || ko > 0) porConta.push({ owner: conta.owner_id, emitidas: ok, falhadas: ko })
  }

  return NextResponse.json({ contas: (contas ?? []).length, emitidas, falhadas, porConta })
}
