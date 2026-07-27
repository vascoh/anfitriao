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

export const PREVIEW_VARS: Record<string, string> = {
  nome: 'Maria Silva',
  propriedade: 'a tua propriedade',
  checkin: '10 ago.',
  checkout: '13 ago.',
}
