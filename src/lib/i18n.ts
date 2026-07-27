export type SiteLang = 'pt' | 'en'

/** Só PT/EN por agora (âmbito da Fase 4) — settings.idioma aceita outros valores no futuro. */
export function resolveLang(idioma: string | null | undefined): SiteLang {
  return idioma === 'en' ? 'en' : 'pt'
}

const STRINGS = {
  nav_inicio: { pt: 'Início', en: 'Home' },
  nav_sobre: { pt: 'Sobre', en: 'About' },
  nav_galeria: { pt: 'Galeria', en: 'Gallery' },
  nav_localizacao: { pt: 'Localização', en: 'Location' },
  nav_blog: { pt: 'Blog', en: 'Blog' },
  blog_empty: { pt: 'Ainda não há posts publicados.', en: 'No posts published yet.' },
  blog_back: { pt: '← Ver todos os posts', en: '← Back to all posts' },
  whatsapp: { pt: 'WhatsApp', en: 'WhatsApp' },
  hero_badge: { pt: 'Reservas diretas · Sem comissões', en: 'Direct booking · No fees' },
  listing_empty: { pt: 'Nenhum alojamento disponível neste momento.', en: 'No accommodation available right now.' },
  reservar: { pt: 'Reservar', en: 'Book now' },
  per_night: { pt: 'por noite', en: 'per night' },
  up_to: { pt: 'até', en: 'up to' },
  cleaning_fee: { pt: 'limpeza', en: 'cleaning' },
  why_title_1: { pt: 'Sem taxas de serviço', en: 'No service fees' },
  why_body_1: {
    pt: 'Reservar diretamente significa pagar menos. Sem comissões para plataformas de terceiros.',
    en: 'Booking directly means paying less. No commissions for third-party platforms.',
  },
  why_title_2: { pt: 'Contacto direto', en: 'Direct contact' },
  why_body_2: {
    pt: 'Comunicação direta com o anfitrião. Pedidos especiais atendidos com mais atenção.',
    en: 'Direct communication with the host. Special requests handled with more care.',
  },
  why_title_3: { pt: 'Cancelamento flexível', en: 'Flexible cancellation' },
  why_body_3: {
    pt: 'Políticas e pagamento acordados diretamente com o anfitrião, sem burocracia.',
    en: 'Policies and payment agreed directly with the host, no red tape.',
  },
  faq_title: { pt: 'Perguntas frequentes', en: 'Frequently asked questions' },
  host_role: { pt: 'Anfitrião', en: 'Host' },
  talk_to_host: { pt: 'Falar com o anfitrião', en: 'Message the host' },
  powered_by: { pt: 'Powered by Anfitrião', en: 'Powered by Anfitrião' },
  footer_privacy: { pt: 'Privacidade', en: 'Privacy' },
  footer_cookies: { pt: 'Cookies', en: 'Cookies' },
  footer_terms: { pt: 'Termos', en: 'Terms' },
} as const

type Key = keyof typeof STRINGS

export function t(lang: SiteLang, key: Key): string {
  return STRINGS[key][lang]
}

export function listingAvailable(lang: SiteLang, n: number): string {
  if (lang === 'en') return n === 1 ? '1 place available' : `${n} places available`
  return n === 1 ? '1 alojamento disponível' : `${n} alojamentos disponíveis`
}

export function minNights(lang: SiteLang, n: number): string {
  return lang === 'en' ? `Minimum ${n} nights` : `Mínimo ${n} noites`
}
