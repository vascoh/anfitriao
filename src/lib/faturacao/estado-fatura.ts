/**
 * Quando é que uma emissão "em curso" deixa de o ser.
 *
 * `a_emitir` é uma reserva feita antes de falar com o fornecedor certificado,
 * para o botão e o cron não emitirem dois documentos. O que faltava era o
 * fim da história: se o processo morresse a meio — fim do tempo da função, um
 * deploy, uma escrita recusada — a reserva ficava lá para sempre. O botão
 * respondia "já está a ser emitida, aguarda" durante meses, e a página mostrava
 * uma roda a girar que nunca parava.
 *
 * Uma emissão real demora segundos. Passados quinze minutos não está a
 * decorrer: está parada, e a diferença importa porque muda o que se diz ao
 * anfitrião — de "aguarda" para "vai ver se a fatura chegou a sair".
 *
 * Deliberadamente **não** se destranca sozinha. A fatura pode ter sido emitida
 * na AT antes da falha; emitir outra por nossa iniciativa duplicaria um
 * documento legal, que depois só se anula por nota de crédito. Quem tem como
 * verificar é o anfitrião, na conta dele.
 */

export const EMISSAO_PRESA_MINUTOS = 15

export interface ReservaComFatura {
  fatura_estado?: string | null
  fatura_reservada_em?: string | null
}

export function emissaoPresa(reserva: ReservaComFatura, agora: number = Date.now()): boolean {
  if (reserva.fatura_estado !== 'a_emitir') return false

  /* Sem hora de reserva é uma emissão anterior a esta coluna. Também está
   * parada — ninguém fica em 'a_emitir' desde antes do último deploy — e
   * tratá-la como em curso era deixá-la presa pela mesma razão de sempre. */
  if (!reserva.fatura_reservada_em) return true

  const inicio = new Date(reserva.fatura_reservada_em).getTime()
  if (Number.isNaN(inicio)) return true

  return agora - inicio > EMISSAO_PRESA_MINUTOS * 60_000
}
