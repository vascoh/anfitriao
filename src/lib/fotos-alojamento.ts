/**
 * O que o construtor do site pode mudar num alojamento: fotografias (a
 * primeira é a capa), descrição, comodidades e regras da casa.
 *
 * Uma fotografia nova só entra se tiver sido carregada por este anfitrião
 * para o nosso armazenamento (`/api/upload` grava em `propriedades/<id>/`).
 * Sem isto, qualquer URL ia parar ao site — e o `next/image` recusa domínios
 * fora da lista, o que deixava a página do alojamento partida. As que já lá
 * estavam (de antes do construtor) mantêm-se.
 */

export const LIMITES_ALOJAMENTO = {
  fotos: 40,
  descricao: 4000,
  regras: 2000,
  comodidades: 30,
  comodidade: 40,
} as const

export interface AlteracoesAlojamento {
  imagem_url?: string | null
  fotos?: string[]
  descricao?: string
  regras_casa?: string
  comodidades?: string[]
}

export function fotoNossaDoAnfitriao(url: string, userId: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
      && u.hostname.endsWith('.public.blob.vercel-storage.com')
      && u.pathname.startsWith(`/propriedades/${userId}/`)
  } catch {
    return false
  }
}

export function validarAlteracoesAlojamento(
  corpo: unknown,
  atuais: string[],
  userId: string,
): { ok: true; alteracoes: AlteracoesAlojamento } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Pedido inválido.' }
  const c = corpo as Record<string, unknown>
  const alteracoes: AlteracoesAlojamento = {}

  if ('fotos' in c) {
    if (!Array.isArray(c.fotos) || c.fotos.some(f => typeof f !== 'string')) {
      return { ok: false, erro: 'Lista de fotografias inválida.' }
    }
    const fotos = [...new Set(c.fotos as string[])]
    if (fotos.length > LIMITES_ALOJAMENTO.fotos) {
      return { ok: false, erro: `No máximo ${LIMITES_ALOJAMENTO.fotos} fotografias por alojamento.` }
    }
    const estranha = fotos.find(f => !atuais.includes(f) && !fotoNossaDoAnfitriao(f, userId))
    if (estranha) return { ok: false, erro: 'Há uma fotografia que não foi carregada por esta conta.' }
    alteracoes.imagem_url = fotos[0] ?? null
    alteracoes.fotos = fotos.slice(1)
  }

  if ('descricao' in c) {
    if (typeof c.descricao !== 'string') return { ok: false, erro: 'Descrição inválida.' }
    if (c.descricao.length > LIMITES_ALOJAMENTO.descricao) {
      return { ok: false, erro: `A descrição tem no máximo ${LIMITES_ALOJAMENTO.descricao} caracteres.` }
    }
    alteracoes.descricao = c.descricao
  }

  if ('regras_casa' in c) {
    if (typeof c.regras_casa !== 'string') return { ok: false, erro: 'Regras inválidas.' }
    if (c.regras_casa.length > LIMITES_ALOJAMENTO.regras) {
      return { ok: false, erro: `As regras têm no máximo ${LIMITES_ALOJAMENTO.regras} caracteres.` }
    }
    alteracoes.regras_casa = c.regras_casa
  }

  if ('comodidades' in c) {
    if (!Array.isArray(c.comodidades) || c.comodidades.some(x => typeof x !== 'string')) {
      return { ok: false, erro: 'Comodidades inválidas.' }
    }
    const lista = [...new Set((c.comodidades as string[]).map(x => x.trim()).filter(Boolean))]
    if (lista.length > LIMITES_ALOJAMENTO.comodidades || lista.some(x => x.length > LIMITES_ALOJAMENTO.comodidade)) {
      return { ok: false, erro: 'Comodidades a mais ou com nome demasiado longo.' }
    }
    alteracoes.comodidades = lista
  }

  if (Object.keys(alteracoes).length === 0) return { ok: false, erro: 'Nada para guardar.' }
  return { ok: true, alteracoes }
}
