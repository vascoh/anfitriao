import { nights } from './utils'

/**
 * Cofre de conformidade — obrigações legais do Alojamento Local em Portugal.
 *
 * Lógica pura e testável: a página `/conformidade` e o cron de alertas
 * (`/api/cron/compliance-alerts`) só apresentam o que é decidido aqui.
 *
 * Enquadramento legal (referência, não aconselhamento jurídico):
 * - RNAL / número de registo — DL 128/2014, alterado pela Lei 56/2023. O número
 *   é obrigatório em toda a publicidade do alojamento, incluindo anúncios em
 *   plataformas.
 * - Seguro de responsabilidade civil — DL 128/2014 art. 13.º-A. Obrigatório e
 *   tem de estar válido; a caducidade é causa de cancelamento do registo.
 * - Livro de Reclamações Eletrónico — DL 74/2017. Obrigatório, com aviso
 *   visível no alojamento indicando o acesso ao livro eletrónico.
 * - Certificado energético — obrigatório para publicitar o imóvel; incluído
 *   aqui como item opcional porque nem todos os anfitriões o gerem na app.
 */

/** Dias de antecedência com que um documento passa a "a expirar". */
export const DIAS_AVISO_EXPIRACAO = 30

export type EstadoItem = 'ok' | 'a_expirar' | 'expirado' | 'em_falta'

export type ChaveItem =
  | 'rnal'
  | 'seguro'
  | 'livro_reclamacoes'
  | 'certificado_energetico'

export interface ItemConformidade {
  chave: ChaveItem
  titulo: string
  /** Base legal, mostrada ao anfitrião para justificar a exigência. */
  base: string
  estado: EstadoItem
  /** Texto curto do estado, já pronto para a UI. */
  detalhe: string
  /** Data de validade, quando o item tem uma. */
  validade?: string | null
  /** Dias até expirar (negativo se já expirou). Só quando há validade. */
  diasParaExpirar?: number
  /** Se false, não conta para o resumo de pendências (item facultativo). */
  obrigatorio: boolean
}

/** Campos de conformidade guardados em `properties` (migration 027). */
export interface CamposConformidade {
  rnal_numero?: string | null
  rnal_data?: string | null
  seguro_seguradora?: string | null
  seguro_apolice?: string | null
  seguro_validade?: string | null
  livro_reclamacoes_registado?: boolean | null
  livro_reclamacoes_url?: string | null
  certificado_energetico_validade?: string | null
}

/**
 * Avalia uma data de validade contra `hoje`.
 * Devolve `em_falta` quando não há data — quem chama decide se isso importa.
 */
export function avaliarValidade(
  validade: string | null | undefined,
  hoje: string,
  diasAviso: number = DIAS_AVISO_EXPIRACAO,
): { estado: EstadoItem; diasParaExpirar?: number } {
  if (!validade) return { estado: 'em_falta' }

  // nights() faz a aritmética em UTC a partir de YYYY-MM-DD, por isso é
  // estável em qualquer timezone (ver convenção em CLAUDE.md).
  const dias = nights(hoje, validade)

  if (dias < 0) return { estado: 'expirado', diasParaExpirar: dias }
  if (dias <= diasAviso) return { estado: 'a_expirar', diasParaExpirar: dias }
  return { estado: 'ok', diasParaExpirar: dias }
}

function textoValidade(estado: EstadoItem, dias: number | undefined, oQue: string): string {
  switch (estado) {
    case 'expirado':
      return dias === undefined
        ? `${oQue} expirado.`
        : `${oQue} expirado há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}.`
    case 'a_expirar':
      if (dias === 0) return `${oQue} expira hoje.`
      return `${oQue} expira em ${dias} ${dias === 1 ? 'dia' : 'dias'}.`
    case 'ok':
      return `${oQue} válido.`
    case 'em_falta':
      return `Sem data de validade registada.`
  }
}

/**
 * Avalia todos os itens de conformidade de um alojamento.
 * `hoje` é injetado (nunca lido de `new Date()` aqui) para o resultado ser
 * determinístico e testável em qualquer timezone.
 */
export function avaliarConformidade(p: CamposConformidade, hoje: string): ItemConformidade[] {
  const itens: ItemConformidade[] = []

  // ── RNAL ──────────────────────────────────────────────────────────────
  const temRnal = Boolean(p.rnal_numero && p.rnal_numero.trim())
  itens.push({
    chave: 'rnal',
    titulo: 'Número de registo (RNAL)',
    base: 'DL 128/2014, alterado pela Lei 56/2023',
    estado: temRnal ? 'ok' : 'em_falta',
    detalhe: temRnal
      ? `Registo ${p.rnal_numero!.trim()}.`
      : 'Obrigatório em toda a publicidade do alojamento, incluindo anúncios em plataformas.',
    obrigatorio: true,
  })

  // ── Seguro de responsabilidade civil ──────────────────────────────────
  const temSeguro = Boolean(p.seguro_apolice && p.seguro_apolice.trim())
  if (!temSeguro) {
    itens.push({
      chave: 'seguro',
      titulo: 'Seguro de responsabilidade civil',
      base: 'DL 128/2014, art. 13.º-A',
      estado: 'em_falta',
      detalhe: 'Obrigatório. A falta ou caducidade é causa de cancelamento do registo.',
      obrigatorio: true,
    })
  } else {
    const { estado, diasParaExpirar } = avaliarValidade(p.seguro_validade, hoje)
    itens.push({
      chave: 'seguro',
      titulo: 'Seguro de responsabilidade civil',
      base: 'DL 128/2014, art. 13.º-A',
      estado,
      detalhe: [
        p.seguro_seguradora?.trim(),
        `apólice ${p.seguro_apolice!.trim()}`,
      ].filter(Boolean).join(' · ') + ' — ' + textoValidade(estado, diasParaExpirar, 'Seguro'),
      validade: p.seguro_validade ?? null,
      diasParaExpirar,
      obrigatorio: true,
    })
  }

  // ── Livro de Reclamações Eletrónico ───────────────────────────────────
  const temLivro = Boolean(p.livro_reclamacoes_registado)
  itens.push({
    chave: 'livro_reclamacoes',
    titulo: 'Livro de Reclamações Eletrónico',
    base: 'DL 74/2017',
    estado: temLivro ? 'ok' : 'em_falta',
    detalhe: temLivro
      ? 'Registado. O aviso com o acesso tem de estar visível no alojamento.'
      : 'Obrigatório. Regista-se no portal oficial e o aviso tem de estar afixado no alojamento.',
    obrigatorio: true,
  })

  // ── Certificado energético (facultativo na app) ───────────────────────
  const { estado: estadoCE, diasParaExpirar: diasCE } = avaliarValidade(
    p.certificado_energetico_validade,
    hoje,
  )
  itens.push({
    chave: 'certificado_energetico',
    titulo: 'Certificado energético',
    base: 'DL 101-D/2020',
    estado: estadoCE,
    detalhe: estadoCE === 'em_falta'
      ? 'Não registado. Necessário para publicitar o imóvel.'
      : textoValidade(estadoCE, diasCE, 'Certificado'),
    validade: p.certificado_energetico_validade ?? null,
    diasParaExpirar: diasCE,
    obrigatorio: false,
  })

  return itens
}

export interface ResumoConformidade {
  total: number
  ok: number
  /** Itens obrigatórios em falta, expirados ou a expirar. */
  pendentes: number
  /** Só os que exigem ação imediata: obrigatórios em falta ou expirados. */
  criticos: number
  /** Obrigatórios a expirar dentro da janela de aviso. */
  aExpirar: number
}

export function resumirConformidade(itens: ItemConformidade[]): ResumoConformidade {
  const obrigatorios = itens.filter(i => i.obrigatorio)
  const criticos = obrigatorios.filter(i => i.estado === 'em_falta' || i.estado === 'expirado').length
  const aExpirar = obrigatorios.filter(i => i.estado === 'a_expirar').length

  return {
    total: itens.length,
    ok: itens.filter(i => i.estado === 'ok').length,
    pendentes: criticos + aExpirar,
    criticos,
    aExpirar,
  }
}

/**
 * Marcos (em dias antes de expirar) em que se envia alerta.
 * Escolhidos para dar tempo de renovar sem transformar o produto em spam:
 * um mês para tratar, uma semana para agir, e o próprio dia.
 */
export const MARCOS_ALERTA = [30, 14, 7, 3, 1, 0] as const

/** De quantos em quantos dias se repete o alerta depois de já ter expirado. */
export const REPETIR_APOS_EXPIRAR_DIAS = 7

/**
 * Decide se hoje é dia de alertar sobre um item com validade.
 *
 * Antes de expirar, alerta nos marcos. Depois de expirar, repete
 * semanalmente — um seguro caducado é motivo de cancelamento do registo,
 * por isso não se deixa cair no silêncio, mas também não se avisa todos os
 * dias.
 *
 * Sem `diasParaExpirar` (item sem data) devolve false: a falta de documento
 * aparece no cofre, mas não gera notificação diária.
 */
export function deveAlertar(diasParaExpirar: number | undefined): boolean {
  if (diasParaExpirar === undefined) return false

  if (diasParaExpirar >= 0) {
    return (MARCOS_ALERTA as readonly number[]).includes(diasParaExpirar)
  }

  return Math.abs(diasParaExpirar) % REPETIR_APOS_EXPIRAR_DIAS === 0
}

/** Itens de um alojamento que hoje justificam notificação. */
export function itensParaAlertar(itens: ItemConformidade[]): ItemConformidade[] {
  return itens.filter(i => i.obrigatorio && deveAlertar(i.diasParaExpirar))
}

/** Ordem de gravidade para ordenar a lista: o que exige ação vem primeiro. */
const PESO: Record<EstadoItem, number> = {
  expirado: 0,
  em_falta: 1,
  a_expirar: 2,
  ok: 3,
}

export function ordenarPorGravidade(itens: ItemConformidade[]): ItemConformidade[] {
  return [...itens].sort((a, b) => {
    // Obrigatórios sempre antes dos facultativos dentro do mesmo estado
    const peso = PESO[a.estado] - PESO[b.estado]
    if (peso !== 0) return peso
    if (a.obrigatorio !== b.obrigatorio) return a.obrigatorio ? -1 : 1
    return a.titulo.localeCompare(b.titulo, 'pt-PT')
  })
}
