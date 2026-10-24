import type { Property } from './types'

/**
 * Fotografias de um alojamento pela ordem do anfitrião. A primeira é a capa
 * (`imagem_url`); as restantes vêm de `fotos`. Repetidas e vazias saem.
 */
export function fotosDe(p: Pick<Property, 'imagem_url' | 'fotos'>): string[] {
  return [...new Set([p.imagem_url, ...(p.fotos ?? [])].filter((u): u is string => Boolean(u)))]
}

/** Quartos ativos de uma casa, pela ordem em que foram criados. */
export function quartosDe(casaId: string, todas: Property[]): Property[] {
  return todas.filter(p => p.parent_id === casaId && p.ativo)
}

/** O que um cartão de alojamento precisa para se desenhar no site. */
export function dadosDoCartao(p: Property, todas: Property[]) {
  const quartos = quartosDe(p.id, todas)
  const fotos = fotosDe(p)
  const fotoDeQuarto = quartos.map(q => fotosDe(q)[0]).find(Boolean) ?? null
  const desde = quartos.length > 0 ? Math.min(...quartos.map(q => q.preco_base)) : null
  return {
    id: p.id,
    nome: p.nome,
    cidade: p.cidade,
    capacidade: p.capacidade,
    quartos: p.quartos,
    preco: desde ?? p.preco_base,
    desde: desde !== null,
    foto: fotos[0] ?? fotoDeQuarto,
    cor: p.cor,
    numFotos: fotos.length + quartos.reduce((s, q) => s + fotosDe(q).length, 0),
  }
}

/**
 * O que falta a um alojamento para a página dele no site ficar completa:
 * 3 fotografias e uma descrição com pelo menos uma frase a sério.
 */
export function faltaNoAlojamento(p: Pick<Property, 'imagem_url' | 'fotos' | 'descricao'>): string[] {
  const falta: string[] = []
  const n = fotosDe(p).length
  if (n < 3) falta.push(n === 0 ? 'fotografias' : `mais ${3 - n} ${3 - n === 1 ? 'fotografia' : 'fotografias'}`)
  if ((p.descricao ?? '').trim().length < 60) falta.push('descrição')
  return falta
}
