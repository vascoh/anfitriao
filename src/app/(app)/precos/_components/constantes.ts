import type { PriceRuleTipo, TarifaTipo, BookingSource } from '@/lib/types'

// ─── label maps ────────────────────────────────────────────────────────────────

export const RULE_TIPO_LABEL: Record<PriceRuleTipo, string> = {
  custom:    'Personalizada',
  seasonal:  'Sazonal',
  weekend:   'Fim de semana',
  holiday:   'Feriado',
  promo:     'Promoção',
  long_stay: 'Longa estadia',
}

export const RULE_TIPO_COLOR: Record<PriceRuleTipo, string> = {
  custom:    'bg-gray-100 text-gray-700',
  seasonal:  'bg-blue-50 text-blue-700',
  weekend:   'bg-purple-50 text-purple-700',
  holiday:   'bg-amber-50 text-amber-700',
  promo:     'bg-emerald-50 text-emerald-700',
  long_stay: 'bg-cyan-50 text-cyan-700',
}

export const TARIFA_TIPO_LABEL: Record<TarifaTipo, string> = {
  standard:      'Standard',
  non_refundable:'Não reembolsável',
  breakfast:     'Pequeno-almoço incl.',
  long_stay:     'Longa estadia',
  promo:         'Promocional',
  corporate:     'Corporate',
  ota:           'OTA específica',
  seasonal:      'Sazonal',
}

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

export const PLATAFORMAS: BookingSource[] = ['airbnb', 'booking', 'expedia', 'vrbo', 'direto', 'outro']
