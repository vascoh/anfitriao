import type { BookingStatus, BookingSource, GuestTag, PropertyType, Guest } from './types'

export function sibaComplete(g: Pick<Guest, 'numero_documento' | 'data_nascimento' | 'tipo_documento' | 'sexo' | 'pais_emissao'>): boolean {
  return !!(g.numero_documento && g.data_nascimento && g.tipo_documento && (g.sexo || g.pais_emissao))
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  checkin: 'Em casa',
  checkout: 'Check-out',
  cancelada: 'Cancelada',
  no_show: 'No-show',
}

export const STATUS_CLASS: Record<BookingStatus, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmada: 'bg-blue-50 text-blue-700 border-blue-200',
  checkin: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  checkout: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelada: 'bg-red-50 text-red-600 border-red-200',
  no_show: 'bg-orange-50 text-orange-700 border-orange-200',
}

export const SOURCE_LABEL: Record<BookingSource, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  direto: 'Direto',
  expedia: 'Expedia',
  vrbo: 'VRBO',
  outro: 'Outro',
}

export const SOURCE_COLOR: Record<BookingSource, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  direto: '#C2714F',
  expedia: '#FFC72C',
  vrbo: '#3D82F6',
  outro: '#9CA3AF',
}

export const SOURCE_BG: Record<BookingSource, string> = {
  airbnb: 'bg-[#FF5A5F]/10 text-[#CC2A2F]',
  booking: 'bg-[#003580]/10 text-[#003580]',
  direto: 'bg-primary/10 text-primary',
  expedia: 'bg-amber-100 text-amber-800',
  vrbo: 'bg-blue-50 text-blue-700',
  outro: 'bg-gray-100 text-gray-600',
}

export const TAG_LABEL: Record<GuestTag, string> = {
  vip: 'VIP',
  frequente: 'Frequente',
  novo: 'Novo',
  problematico: 'Atenção',
}

export const TAG_CLASS: Record<GuestTag, string> = {
  vip: 'bg-amber-50 text-amber-700 border-amber-200',
  frequente: 'bg-blue-50 text-blue-700 border-blue-200',
  novo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  problematico: 'bg-red-50 text-red-600 border-red-200',
}

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  apartamento: 'Apartamento',
  moradia: 'Moradia',
  quarto: 'Studio / Quarto',
  outro: 'Outro',
}
