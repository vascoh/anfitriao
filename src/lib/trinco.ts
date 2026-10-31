import 'server-only'
import { createAdminClient } from './supabase'

/**
 * Exclusão mútua entre funções, contada na base (migração 055).
 *
 * Com a sincronização iCal a correr de 15 em 15 minutos, passa a ser normal
 * coincidirem duas passagens no mesmo alojamento — o cron do Supabase, o da
 * Vercel e o botão do anfitrião. Sem isto, as duas leem a lista de reservas já
 * importadas antes de qualquer uma inserir, e inserem as duas o mesmo evento.
 *
 * O trinco tem prazo: uma função que morra a meio não tranca o alojamento —
 * passado o prazo, a próxima passagem apanha-o.
 */
export type ResultadoTrinco<T> =
  | { obtido: true; valor: T }
  | { obtido: false }

export async function comTrinco<T>(
  chave: string,
  segundos: number,
  fn: () => Promise<T>,
): Promise<ResultadoTrinco<T>> {
  const supabase = createAdminClient()
  const dono = crypto.randomUUID()

  const { data, error } = await supabase.rpc('adquirir_trinco', {
    p_chave: chave,
    p_dono: dono,
    p_segundos: segundos,
  })

  /* Base indisponível para o trinco: corre na mesma. O índice único em
   * (propriedade_id, uid_externo) recusa a inserção duplicada, e parar a
   * sincronização por causa do trinco seria trocar um risco pequeno (uma
   * inserção recusada) por um grande (o calendário parado). */
  if (error) {
    console.error('[trinco] não foi possível obter', chave, error.message)
    return { obtido: true, valor: await fn() }
  }
  if (data !== true) return { obtido: false }

  try {
    return { obtido: true, valor: await fn() }
  } finally {
    const { error: erroLibertar } = await supabase.rpc('libertar_trinco', { p_chave: chave, p_dono: dono })
    if (erroLibertar) console.error('[trinco] não foi libertado (expira sozinho)', chave, erroLibertar.message)
  }
}
