import 'server-only'
import { createAdminClient } from './supabase'
import { checkRateLimit, type RateLimitResult } from './rate-limit'

/**
 * Limitador de pedidos que conta no sítio certo: na base de dados.
 *
 * O limitador em memória (`checkRateLimit`) tem um `Map` por processo. Em
 * Vercel há tantos processos quantas as instâncias que a plataforma decidir
 * arrancar, e cada uma conta a partir do zero — um limite de 60/hora é 60
 * **vezes o número de instâncias**, e volta a zero em cada deploy.
 *
 * Medido em produção: 90 pedidos em paralelo ao endereço público de check-in,
 * limite de 60/hora, nenhum recusado. Logo a seguir, 70 pedidos em série — que
 * caem quase todos na mesma instância quente — começaram a ser recusados ao
 * 30.º. A regra existia e nunca chegou a valer para quem manda pedidos ao
 * mesmo tempo, que é exatamente quem se quer travar.
 *
 * Vale a pena onde o limite protege alguma coisa: dados pessoais numa rota
 * pública, ou dinheiro (IA, uploads). Para o resto, o limitador em memória
 * chega — é grátis e apanha o caso comum.
 *
 * ## Porquê os dois
 *
 * A memória responde primeiro porque é instantânea e apanha a repetição óbvia
 * sem ir à base. A base só é consultada por quem passou nessa primeira porta,
 * e é ela que dá a resposta que conta.
 */

/** Se a base falhar, deixa passar. Ver a nota no fim do ficheiro. */
export async function verificarLimite(
  chave: string,
  limite: number,
  janelaMs: number,
): Promise<RateLimitResult> {
  /* Primeira porta, de graça: quem já rebentou o limite nesta instância nem
   * chega a incomodar a base. Usa-se um limite igual, não menor — a memória
   * nunca pode ser mais permissiva do que a contagem verdadeira. */
  const local = checkRateLimit(chave, limite, janelaMs)
  if (!local.allowed) return local

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('registar_pedido', {
    p_chave: chave,
    p_janela_ms: janelaMs,
    p_limite: limite,
  })

  if (error || !data) {
    /* A base indisponível não pode fechar a porta a toda a gente: um erro aqui
     * trancaria o check-in de todos os hóspedes de todos os anfitriões. Fica a
     * primeira porta, que é o que havia antes disto existir. */
    console.error('[rate-limit] contagem persistente falhou:', error?.message)
    return local
  }

  const resultado = data as { permitido: boolean; restantes: number; reinicia_em: number }
  return {
    allowed: resultado.permitido,
    remaining: resultado.restantes,
    resetAt: Math.round(resultado.reinicia_em),
  }
}

/**
 * Apaga contagens já expiradas.
 *
 * A tabela recebe uma escrita por pedido nas rotas públicas; sem limpeza
 * crescia indefinidamente. Um dia é folga suficiente para qualquer janela em
 * uso (a maior é de uma hora).
 */
export async function limparLimitesAntigos(): Promise<number> {
  const supabase = createAdminClient()
  const ontem = new Date(Date.now() - 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('limites_pedidos')
    .delete()
    .lt('janela_inicio', ontem)
    .select('chave')

  if (error) {
    console.error('[rate-limit] limpeza', error.message)
    return 0
  }
  return (data ?? []).length
}
