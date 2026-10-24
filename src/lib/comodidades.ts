import type { SiteLang } from './i18n'

/**
 * Comodidades que o anfitrião pode marcar num alojamento, com o nome que o
 * hóspede lê no site em cada idioma. A chave é o que fica gravado em
 * `properties.comodidades`.
 */
export const COMODIDADES = [
  { id: 'wifi', pt: 'Wi-Fi', en: 'Wi-Fi' },
  { id: 'ar_condicionado', pt: 'Ar condicionado', en: 'Air conditioning' },
  { id: 'estacionamento', pt: 'Estacionamento', en: 'Parking' },
  { id: 'piscina', pt: 'Piscina', en: 'Pool' },
  { id: 'cozinha', pt: 'Cozinha equipada', en: 'Kitchen' },
  { id: 'maquina_lavar', pt: 'Máquina de lavar', en: 'Washing machine' },
  { id: 'secador', pt: 'Secador', en: 'Hair dryer' },
  { id: 'tv', pt: 'TV', en: 'TV' },
  { id: 'varanda', pt: 'Varanda', en: 'Balcony' },
  { id: 'jardim', pt: 'Jardim', en: 'Garden' },
] as const

export type ComodidadeId = (typeof COMODIDADES)[number]['id']

const IDS = new Set<string>(COMODIDADES.map(c => c.id))

export function eComodidade(id: unknown): id is ComodidadeId {
  return typeof id === 'string' && IDS.has(id)
}

/** Nome da comodidade; uma chave antiga ou escrita à mão aparece tal como está. */
export function nomeComodidade(id: string, lang: SiteLang): string {
  const c = COMODIDADES.find(x => x.id === id)
  return c ? c[lang] : id
}
