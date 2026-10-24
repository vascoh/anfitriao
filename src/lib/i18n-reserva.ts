import type { SiteLang } from './i18n'

/**
 * Textos da página do alojamento no site do anfitrião (galeria, calendário e
 * pedido de reserva), em português de Portugal e inglês.
 */
const TEXTOS = {
  fotos_todas: { pt: 'Ver as {n} fotografias', en: 'See all {n} photos' },
  fotos_fechar: { pt: 'Fechar', en: 'Close' },
  fotos_anterior: { pt: 'Fotografia anterior', en: 'Previous photo' },
  fotos_seguinte: { pt: 'Fotografia seguinte', en: 'Next photo' },
  hospedes: { pt: 'hóspedes', en: 'guests' },
  hospede: { pt: 'hóspede', en: 'guest' },
  camas: { pt: 'quartos', en: 'bedrooms' },
  cama: { pt: 'quarto', en: 'bedroom' },
  wc: { pt: 'casas de banho', en: 'bathrooms' },
  wc1: { pt: 'casa de banho', en: 'bathroom' },
  comodidades: { pt: 'O que há', en: 'What this place offers' },
  regras: { pt: 'Regras da casa', en: 'House rules' },
  quartos_titulo: { pt: 'Os quartos', en: 'The rooms' },
  quartos_texto: { pt: 'Cada quarto reserva-se à parte. Para ficar com a casa toda, usa a reserva da casa inteira.', en: 'Each room is booked on its own. To have the whole house, use the whole-house booking.' },
  ver_quarto: { pt: 'Ver quarto', en: 'View room' },
  desde: { pt: 'desde', en: 'from' },
  noite: { pt: 'noite', en: 'night' },
  noites: { pt: 'noites', en: 'nights' },
  voltar_casa: { pt: 'Voltar a {nome}', en: 'Back to {nome}' },
  escolher_entrada: { pt: 'Escolhe o dia de chegada', en: 'Pick your arrival date' },
  escolher_saida: { pt: 'Agora o dia de saída', en: 'Now pick your departure date' },
  intervalo_ocupado: { pt: 'Há noites ocupadas pelo meio. Escolhe outras datas.', en: 'Some nights in between are taken. Pick other dates.' },
  limpar: { pt: 'Limpar datas', en: 'Clear dates' },
  mes_anterior: { pt: 'Mês anterior', en: 'Previous month' },
  mes_seguinte: { pt: 'Mês seguinte', en: 'Next month' },
  ocupado: { pt: 'Ocupado', en: 'Booked' },
  legenda_preco: { pt: 'Preço por noite', en: 'Price per night' },
  minimo: { pt: 'Mínimo de {n} noites', en: 'Minimum {n} nights' },
  numero_hospedes: { pt: 'Hóspedes', en: 'Guests' },
  noites_x: { pt: '{n} noites × {preco}', en: '{n} nights × {preco}' },
  noite_x: { pt: '1 noite × {preco}', en: '1 night × {preco}' },
  limpeza: { pt: 'Limpeza', en: 'Cleaning' },
  ajuste: { pt: 'Ajuste da tarifa', en: 'Rate adjustment' },
  total: { pt: 'Total', en: 'Total' },
  nome: { pt: 'Nome', en: 'Name' },
  email: { pt: 'Email', en: 'Email' },
  telefone: { pt: 'Telefone (opcional)', en: 'Phone (optional)' },
  mensagem: { pt: 'Mensagem para o anfitrião (opcional)', en: 'Message to the host (optional)' },
  pedir: { pt: 'Pedir reserva', en: 'Request booking' },
  pagar: { pt: 'Reservar e pagar', en: 'Book and pay' },
  a_enviar: { pt: 'A enviar…', en: 'Sending…' },
  nota_pedido: { pt: 'É um pedido: o anfitrião confirma antes de haver qualquer pagamento.', en: 'This is a request: the host confirms before any payment.' },
  nota_pagamento: { pt: 'Pagamento seguro com cartão. A reserva fica confirmada ao pagar.', en: 'Secure card payment. Your booking is confirmed on payment.' },
  erro_envio: { pt: 'O pedido não foi enviado. Tenta outra vez.', en: 'The request was not sent. Please try again.' },
  escolhe_datas: { pt: 'Escolhe as datas para ver o total', en: 'Pick dates to see the total' },
  ver_datas: { pt: 'Ver datas', en: 'See dates' },
  indisponivel: { pt: 'Não foi possível confirmar a disponibilidade neste momento. Tenta daqui a pouco.', en: 'We could not check availability right now. Please try again shortly.' },
  nao_disponivel: { pt: 'Este alojamento não está disponível.', en: 'This place is not available.' },
  ver_todos: { pt: 'Ver todos os alojamentos', en: 'See all places' },
  sem_fotos: { pt: 'Fotografias em breve', en: 'Photos coming soon' },
} as const

export type ChaveReserva = keyof typeof TEXTOS

/** Texto traduzido, com `{marcas}` substituídas pelos valores dados. */
export function tr(lang: SiteLang, chave: ChaveReserva, valores: Record<string, string | number> = {}): string {
  return TEXTOS[chave][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? `{${k}}`))
}

export const MESES = {
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const

export const DIAS_SEMANA = {
  pt: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
} as const
