/**
 * Até quando é que o link de check-in mostra dados pessoais.
 *
 * O URL do check-in é o id da reserva, e é partilhado por email ou WhatsApp —
 * ou seja, fica para sempre na caixa de correio de quem o recebeu, em cópias
 * reencaminhadas, em telemóveis emprestados. Enquanto respondesse com a ficha
 * completa, esse link era uma janela **permanente** para o número do
 * documento, a data de nascimento e a morada de quem lá dormiu. O próprio
 * código já reconhecia o risco noutro sítio: o feed iCal público troca o id
 * real por um hash exatamente para não dar acesso a esta rota.
 *
 * A janela fecha quando o link cumpriu o que tinha a fazer:
 *
 * - **check-in submetido** — os dados já estão registados, e a página só
 *   mostra "check-in já submetido";
 * - **estadia terminada** — não há nada para preencher depois de a pessoa
 *   sair.
 *
 * Fechada a janela, a reserva continua a responder (datas, alojamento, quem
 * recebe) para a página poder explicar-se; o que deixa de sair são os dados
 * das pessoas. É a mesma ideia da política de retenção: cumprido o fim,
 * acaba o fundamento.
 */
export interface EstadoDoLink {
  /** Se os dados pessoais podem ir para o browser. */
  mostraDados: boolean
  motivo: 'aberto' | 'ja_submetido' | 'estadia_terminada'
}

export function janelaDeCheckin(p: {
  jaSubmetido: boolean
  /** `YYYY-MM-DD` do check-out da reserva. */
  checkOut: string | null | undefined
  hoje: string
}): EstadoDoLink {
  if (p.jaSubmetido) return { mostraDados: false, motivo: 'ja_submetido' }

  // O dia do check-out ainda conta: a pessoa pode estar a sair nesse dia e a
  // acabar de preencher o que faltava.
  if (p.checkOut && p.checkOut < p.hoje) {
    return { mostraDados: false, motivo: 'estadia_terminada' }
  }

  return { mostraDados: true, motivo: 'aberto' }
}
