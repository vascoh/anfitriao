import type { AutomationTrigger } from './types'

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
