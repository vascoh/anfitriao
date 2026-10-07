import type { SiteLang } from './i18n'
import { t } from './i18n'

/**
 * O mapa do site do anfitrião: que páginas existem, por que ordem aparecem no
 * menu, que secções tem a página inicial e o texto que o anfitrião escreveu
 * para cada uma.
 *
 * ## Onde vive
 *
 * Em `website_settings.secoes` (jsonb), ao lado do FAQ que já lá estava. Não
 * há tabela nova: o mapa é pequeno, muda inteiro de uma vez a partir de um só
 * editor, e lê-se sempre junto com as definições do site — que as páginas
 * públicas já carregam.
 *
 * ## Porque é que tudo passa por `normalizarSecoes`
 *
 * O jsonb aceita qualquer coisa que o browser mande. Antes disto o `secoes`
 * era gravado tal como chegava; com páginas próprias e textos livres isso
 * passava a ser uma porta para gravar megabytes, chaves inventadas ou um slug
 * que colide com uma rota do site. Escrever lê sempre o resultado desta
 * função, e as páginas públicas também, para que um valor antigo ou estragado
 * na base nunca chegue ao hóspede tal como está.
 *
 * ## Sobre os valores por omissão
 *
 * Um site que já está no ar não pode mudar sozinho por causa disto. Por isso
 * a falta de mapa dá exatamente o site de antes: as quatro páginas no menu,
 * pela ordem de sempre, e as secções da inicial como estavam. A secção nova
 * (fotografias) nasce escondida.
 */

export const PAGINAS_FIXAS = ['sobre', 'galeria', 'localizacao', 'blog'] as const
export type PaginaFixa = (typeof PAGINAS_FIXAS)[number]

/** Secções da página inicial que se podem mover. O topo (hero) fica sempre em cima. */
export const SECOES_INICIO = ['alojamentos', 'fotos', 'porque', 'faq', 'anfitriao'] as const
export type SecaoInicio = (typeof SECOES_INICIO)[number]

/** Os alojamentos são a razão de ser do site: movem-se, mas não se escondem. */
export const SECOES_OBRIGATORIAS: readonly SecaoInicio[] = ['alojamentos']

const SECOES_OCULTAS_POR_OMISSAO: readonly SecaoInicio[] = ['fotos']

export interface PaginaPropria {
  slug: string
  titulo: string
  texto: string
  visivel: boolean
}

export interface ItemPorque {
  titulo: string
  texto: string
}

export interface SiteSecoes {
  faq?: Array<{ pergunta: string; resposta: string }>
  /** Ordem e visibilidade das secções da inicial. */
  inicio?: Array<{ id: SecaoInicio; visivel: boolean }>
  /** Páginas fixas: aparecem ou não, e com que nome no menu. */
  paginas?: Partial<Record<PaginaFixa, { visivel?: boolean; nome?: string }>>
  /** Ordem do menu: ids das páginas fixas e `p:<slug>` das próprias. */
  menu?: string[]
  /** Fotografia de fundo do topo da inicial — uma das fotos dos alojamentos. */
  hero_imagem?: string | null
  /** Os três argumentos de «reservar direto», se o anfitrião os quiser reescrever. */
  porque?: ItemPorque[]
  /** Texto longo da página Sobre, por baixo da frase do anfitrião. */
  sobre_texto?: string
  paginas_proprias?: PaginaPropria[]
}

// ─── Limites ──────────────────────────────────────────────────────────────────

export const LIMITES = {
  faq: 20,
  pergunta: 200,
  resposta: 1500,
  nomeMenu: 30,
  porqueTitulo: 60,
  porqueTexto: 240,
  sobreTexto: 6000,
  paginasProprias: 6,
  tituloPagina: 80,
  textoPagina: 12000,
  url: 1000,
} as const

/** Slugs que já são rotas do site — uma página própria com um destes ficaria tapada. */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set<string>([
  ...PAGINAS_FIXAS, 'privacidade', 'cookies', 'termos', 'sitemap', 'p', 'inicio', 'book', 'r',
])

// ─── Normalização ─────────────────────────────────────────────────────────────

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : ''
}

/** Slug de página própria a partir do título: minúsculas, sem acentos, hífens. */
export function slugDePagina(titulo: string): string {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function isPaginaFixa(v: unknown): v is PaginaFixa {
  return typeof v === 'string' && (PAGINAS_FIXAS as readonly string[]).includes(v)
}

function isSecaoInicio(v: unknown): v is SecaoInicio {
  return typeof v === 'string' && (SECOES_INICIO as readonly string[]).includes(v)
}

/**
 * Limpa o `secoes` que veio do browser ou da base.
 *
 * `fotosPermitidas`, quando dado, é o conjunto de fotografias dos alojamentos
 * do anfitrião: a imagem do topo tem de ser uma delas. Sem isto, o campo
 * aceitava qualquer endereço e o site passava a mostrar o que lá se pusesse.
 */
export function normalizarSecoes(raw: unknown, fotosPermitidas?: ReadonlySet<string>): SiteSecoes {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: SiteSecoes = {}

  if (Array.isArray(r.faq)) {
    out.faq = r.faq.slice(0, LIMITES.faq).flatMap(item => {
      const i = (item ?? {}) as Record<string, unknown>
      const pergunta = texto(i.pergunta, LIMITES.pergunta)
      const resposta = texto(i.resposta, LIMITES.resposta)
      return pergunta || resposta ? [{ pergunta, resposta }] : []
    })
  }

  if (Array.isArray(r.inicio)) {
    const vistos = new Set<SecaoInicio>()
    out.inicio = r.inicio.flatMap(item => {
      const i = (item ?? {}) as Record<string, unknown>
      if (!isSecaoInicio(i.id) || vistos.has(i.id)) return []
      vistos.add(i.id)
      return [{ id: i.id, visivel: SECOES_OBRIGATORIAS.includes(i.id) ? true : i.visivel !== false }]
    })
  }

  if (r.paginas && typeof r.paginas === 'object') {
    const paginas: SiteSecoes['paginas'] = {}
    for (const [id, valor] of Object.entries(r.paginas as Record<string, unknown>)) {
      if (!isPaginaFixa(id) || !valor || typeof valor !== 'object') continue
      const v = valor as Record<string, unknown>
      const nome = texto(v.nome, LIMITES.nomeMenu)
      paginas[id] = { visivel: v.visivel !== false, ...(nome ? { nome } : {}) }
    }
    out.paginas = paginas
  }

  if (Array.isArray(r.paginas_proprias)) {
    const usados = new Set<string>()
    out.paginas_proprias = r.paginas_proprias.slice(0, LIMITES.paginasProprias).flatMap(item => {
      const i = (item ?? {}) as Record<string, unknown>
      const titulo = texto(i.titulo, LIMITES.tituloPagina)
      if (!titulo) return []
      let slug = slugDePagina(texto(i.slug, 60) || titulo) || 'pagina'
      if (SLUGS_RESERVADOS.has(slug)) slug = `${slug}-1`
      // Dois títulos iguais não podem dar o mesmo endereço.
      const base = slug
      for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`
      usados.add(slug)
      return [{ slug, titulo, texto: texto(i.texto, LIMITES.textoPagina), visivel: i.visivel !== false }]
    })
  }

  if (Array.isArray(r.menu)) {
    const validos = new Set<string>([
      ...PAGINAS_FIXAS,
      ...(out.paginas_proprias ?? []).map(p => `p:${p.slug}`),
    ])
    out.menu = [...new Set(r.menu.filter((m): m is string => typeof m === 'string' && validos.has(m)))]
  }

  if (typeof r.hero_imagem === 'string') {
    const url = texto(r.hero_imagem, LIMITES.url)
    const valida = /^https:\/\//.test(url) && (!fotosPermitidas || fotosPermitidas.has(url))
    if (valida) out.hero_imagem = url
  }

  if (Array.isArray(r.porque)) {
    const porque = r.porque.slice(0, 3).map(item => {
      const i = (item ?? {}) as Record<string, unknown>
      return { titulo: texto(i.titulo, LIMITES.porqueTitulo), texto: texto(i.texto, LIMITES.porqueTexto) }
    })
    if (porque.some(p => p.titulo || p.texto)) out.porque = porque
  }

  const sobre = texto(r.sobre_texto, LIMITES.sobreTexto)
  if (sobre) out.sobre_texto = sobre

  return out
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

/** Secções da inicial pela ordem do anfitrião, com as que faltam no fim. */
export function secoesDoInicio(secoes: SiteSecoes | null | undefined): Array<{ id: SecaoInicio; visivel: boolean }> {
  const gravadas = secoes?.inicio ?? []
  const presentes = new Set(gravadas.map(s => s.id))
  return [
    ...gravadas,
    ...SECOES_INICIO.filter(id => !presentes.has(id)).map(id => ({
      id,
      visivel: !SECOES_OCULTAS_POR_OMISSAO.includes(id),
    })),
  ]
}

export function paginaFixaVisivel(secoes: SiteSecoes | null | undefined, id: PaginaFixa): boolean {
  return secoes?.paginas?.[id]?.visivel !== false
}

export function paginaPropria(secoes: SiteSecoes | null | undefined, slug: string): PaginaPropria | null {
  return secoes?.paginas_proprias?.find(p => p.slug === slug) ?? null
}

const ROTULO_FIXA = {
  sobre: 'nav_sobre',
  galeria: 'nav_galeria',
  localizacao: 'nav_localizacao',
  blog: 'nav_blog',
} as const satisfies Record<PaginaFixa, Parameters<typeof t>[1]>

export function nomePaginaFixa(secoes: SiteSecoes | null | undefined, id: PaginaFixa, lang: SiteLang): string {
  return secoes?.paginas?.[id]?.nome || t(lang, ROTULO_FIXA[id])
}

export interface EntradaMenu {
  /** `sobre`, `galeria`… ou `p:<slug>`. */
  id: string
  /** Caminho relativo à raiz do site: `/sobre`, `/p/regras-da-casa`. */
  href: string
  label: string
  visivel: boolean
  propria: boolean
}

/**
 * Todas as páginas que entram no menu, pela ordem do anfitrião — visíveis ou
 * não, para o editor poder mostrar o mapa inteiro. O site filtra `visivel`.
 * Páginas novas (fixas ou próprias) que ainda não estão em `menu` vão para o fim.
 */
export function entradasDoMenu(secoes: SiteSecoes | null | undefined, lang: SiteLang): EntradaMenu[] {
  const proprias = secoes?.paginas_proprias ?? []
  const todas = new Map<string, EntradaMenu>()
  for (const id of PAGINAS_FIXAS) {
    todas.set(id, {
      id, href: `/${id}`, label: nomePaginaFixa(secoes, id, lang),
      visivel: paginaFixaVisivel(secoes, id), propria: false,
    })
  }
  for (const p of proprias) {
    todas.set(`p:${p.slug}`, { id: `p:${p.slug}`, href: `/p/${p.slug}`, label: p.titulo, visivel: p.visivel, propria: true })
  }
  const ordem = (secoes?.menu ?? []).filter(id => todas.has(id))
  const resto = [...todas.keys()].filter(id => !ordem.includes(id))
  return [...ordem, ...resto].map(id => todas.get(id)!)
}

/** Textos de «porquê reservar direto»: os do anfitrião, ou os de fábrica. */
export function itensPorque(secoes: SiteSecoes | null | undefined, lang: SiteLang): ItemPorque[] {
  const fabrica: ItemPorque[] = [
    { titulo: t(lang, 'why_title_1'), texto: t(lang, 'why_body_1') },
    { titulo: t(lang, 'why_title_2'), texto: t(lang, 'why_body_2') },
    { titulo: t(lang, 'why_title_3'), texto: t(lang, 'why_body_3') },
  ]
  return fabrica.map((f, i) => ({
    titulo: secoes?.porque?.[i]?.titulo || f.titulo,
    texto: secoes?.porque?.[i]?.texto || f.texto,
  }))
}

/** Parágrafos de texto simples (sem HTML nem markdown — como o blog). */
export function paragrafos(textoLivre: string | undefined): string[] {
  return (textoLivre ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
}
