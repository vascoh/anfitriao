/**
 * Taxas de IVA aplicáveis ao Alojamento Local.
 *
 * Fontes (verificado 2026-07-28):
 * - Alojamento: taxa reduzida sobre o valor das dormidas e serviços incluídos
 *   não cobrados à parte — **6% no continente, 5% na Madeira, 4% nos Açores**.
 * - Taxa municipal turística: **não sujeita a IVA** (art. 2.º n.º 2 do CIVA).
 *   O código de isenção a indicar na fatura é **M99**.
 */

export type Regiao = 'continente' | 'madeira' | 'acores'

export const IVA_ALOJAMENTO: Record<Regiao, number> = {
  continente: 6,
  madeira: 5,
  acores: 4,
}

/** Código de isenção do CIVA para a taxa municipal turística. */
export const ISENCAO_TAXA_TURISTICA = 'M99'

/**
 * Concelhos das regiões autónomas, para inferir a taxa a partir de
 * `properties.cidade`. Lista fechada — são 11 na Madeira e 19 nos Açores.
 */
const CONCELHOS_MADEIRA = [
  'calheta', 'câmara de lobos', 'funchal', 'machico', 'ponta do sol',
  'porto moniz', 'porto santo', 'ribeira brava', 'santa cruz', 'santana',
  'são vicente',
]

const CONCELHOS_ACORES = [
  'angra do heroísmo', 'calheta de são jorge', 'corvo', 'horta', 'lagoa dos açores',
  'lajes das flores', 'lajes do pico', 'madalena', 'nordeste', 'ponta delgada',
  'povoação', 'praia da vitória', 'ribeira grande', 'santa cruz da graciosa',
  'santa cruz das flores', 'são roque do pico', 'velas', 'vila do porto',
  'vila franca do campo',
]

function normalizar(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Infere a região a partir do concelho.
 *
 * ⚠️ Ambiguidades conhecidas: "Calheta" existe na Madeira e em São Jorge;
 * "Lagoa" existe no Algarve e em São Miguel; "Santa Cruz" existe na Madeira,
 * nas Flores e na Graciosa. Nesses casos devolve-se `continente` (o caso mais
 * provável e a taxa mais alta, que erra a favor do Estado e não do
 * contribuinte) e quem chama deve poder sobrepor manualmente.
 */
export function regiaoDoConcelho(concelho: string | null | undefined): Regiao {
  if (!concelho) return 'continente'
  const c = normalizar(concelho)
  if (CONCELHOS_MADEIRA.includes(c)) return 'madeira'
  if (CONCELHOS_ACORES.includes(c)) return 'acores'
  return 'continente'
}

export function taxaIvaAlojamento(concelho: string | null | undefined): number {
  return IVA_ALOJAMENTO[regiaoDoConcelho(concelho)]
}

/**
 * Converte um valor com IVA incluído no valor sem IVA.
 * Os preços no Anfitrião são o que o hóspede paga, ou seja, já com IVA.
 */
export function semIva(valorComIva: number, taxaIva: number): number {
  return Math.round((valorComIva / (1 + taxaIva / 100)) * 100) / 100
}

/** Valor do IVA contido num montante com IVA incluído. */
export function valorIva(valorComIva: number, taxaIva: number): number {
  return Math.round((valorComIva - semIva(valorComIva, taxaIva)) * 100) / 100
}
