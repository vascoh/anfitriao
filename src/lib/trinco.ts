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

export interface OpcoesTrinco {
  /**
   * Quanto tempo esperar pelo trinco antes de desistir. Por omissão não se
   * espera: a sincronização ocupada salta-se, a próxima passagem apanha-a.
   * Num pedido de um utilizador (o check-in) espera-se, para o segundo envio
   * correr **depois** do primeiro em vez de ser recusado.
   */
  esperarMs?: number
}

const INTERVALO_MS = 250

export async function comTrinco<T>(
  chave: string,
  segundos: number,
  fn: () => Promise<T>,
  { esperarMs = 0 }: OpcoesTrinco = {},
): Promise<ResultadoTrinco<T>> {
  const supabase = createAdminClient()
  const dono = crypto.randomUUID()
  const limite = Date.now() + esperarMs

  const adquirir = () => supabase.rpc('adquirir_trinco', {
    p_chave: chave,
    p_dono: dono,
    p_segundos: segundos,
  })

  let { data, error } = await adquirir()
  while (!error && data !== true && Date.now() + INTERVALO_MS <= limite) {
    await new Promise(r => setTimeout(r, INTERVALO_MS))
    ;({ data, error } = await adquirir())
  }

  /* Base indisponível para o trinco: corre na mesma. O trinco evita o
   * duplicado de uma corrida rara; recusar por causa dele trocava esse risco
   * por um maior — o calendário parado, ou um check-in que não grava. Na
   * sincronização, o índice único em (propriedade_id, uid_externo) continua a
   * recusar a inserção duplicada. */
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
