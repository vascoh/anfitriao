import type { AutomationTrigger, BookingStatus } from './types'

export const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  checkin_amanha: 'Check-in amanhã',
  checkout_hoje: 'Checkout hoje',
  pedir_avaliacao: 'Pedir avaliação (1 dia após checkout)',
}

/** Coluna de data e desvio (em dias face a hoje) que cada gatilho observa. */
export const TRIGGER_DATE: Record<AutomationTrigger, { coluna: 'check_in' | 'check_out'; offsetDias: number }> = {
  checkin_amanha: { coluna: 'check_in', offsetDias: 1 },
  checkout_hoje: { coluna: 'check_out', offsetDias: 0 },
  pedir_avaliacao: { coluna: 'check_out', offsetDias: -1 },
}

/**
 * Estados de reserva em que cada gatilho ainda faz sentido disparar.
 *
 * `checkin_amanha` observa uma reserva que **ainda não começou** — só pode
 * estar em `pendente`/`confirmada`. `pedir_avaliacao` observa uma estadia
 * **já terminada** — qualquer estado excepto cancelamento serve.
 *
 * `checkout_hoje` fica no meio, e é onde isto já esteve errado: a estadia
 * pode estar em curso, com o hóspede já marcado como `checkin` (o botão
 * "Registar check-in" em `/hoje`, ou o check-in online, não muda o estado —
 * mas o anfitrião pode tê-lo feito manualmente). Tratar `checkout_hoje` como
 * "ainda não começou" excluía `checkin` da consulta, e a maioria das
 * reservas que chegam ao dia de saída já lá está — o lembrete de checkout
 * nunca chegava a ser enviado a quem o anfitrião já tinha assinalado como
 * hospedado.
 */
export function estadosParaGatilho(trigger: AutomationTrigger): BookingStatus[] {
  if (trigger === 'checkin_amanha') return ['confirmada', 'pendente']
  if (trigger === 'checkout_hoje') return ['confirmada', 'pendente', 'checkin']
  return ['confirmada', 'pendente', 'checkin', 'checkout']
}

export function renderAutomationMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

/**
 * Uma mensagem por pessoa, não por reserva.
 *
 * Uma casa alugada por inteiro são N reservas na base, uma por quarto, com o
 * mesmo hóspede e as mesmas datas. O motor de automações é anterior aos
 * grupos e tratava-as como N reservas independentes: o hóspede recebia o
 * mesmo "o teu check-in é amanhã" três vezes, na mesma manhã. É o mesmo
 * princípio que o pedido de reserva já aplicava — uma notificação, não três,
 * porque foi um pedido e não três.
 *
 * Devolve a reserva que representa cada envio e as irmãs que ela cobre — as
 * irmãs também vão para o `automation_log`, senão a execução do dia seguinte
 * achava que estavam por enviar.
 */
export function envioPorGrupo<T extends { id: string; reserva_grupo_id?: string | null }>(
  bookings: T[],
): Array<{ principal: T; cobertas: T[] }> {
  const porChave = new Map<string, T[]>()

  for (const b of bookings) {
    const chave = b.reserva_grupo_id ?? `solo:${b.id}`
    porChave.set(chave, [...(porChave.get(chave) ?? []), b])
  }

  return [...porChave.values()].map(lista => {
    // A mais antiga representa o grupo, para o envio não depender da ordem
    // com que a base devolveu as linhas.
    const ordenadas = [...lista].sort((a, b) => a.id.localeCompare(b.id))
    return { principal: ordenadas[0], cobertas: ordenadas.slice(1) }
  })
}

export const PREVIEW_VARS: Record<string, string> = {
  nome: 'Maria Silva',
  propriedade: 'a tua propriedade',
  checkin: '10 ago.',
  checkout: '13 ago.',
}
