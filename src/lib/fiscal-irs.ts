/**
 * Mapa fiscal do AL em IRS: Categoria B (regime simplificado) vs opção pela
 * Categoria F.
 *
 * Fontes — todas lidas no texto consolidado do CIRS no Portal das Finanças a
 * 2026-09-25:
 *
 * - **art. 31.º, n.º 1** (regime simplificado):
 *   - a) 0,15 — atividades hoteleiras e similares, **com exceção** do AL na
 *     modalidade de moradia ou apartamento (fica aqui a hospedagem e os quartos);
 *   - c) 0,35 — restantes prestações de serviços (é aqui que cai o AL em
 *     moradia/apartamento);
 *   - h) 0,50 — AL em moradia/apartamento localizado em **área de contenção**.
 * - **art. 31.º, n.º 13**: nas alíneas b) e c), acresce ao rendimento a
 *   diferença positiva entre 15 % dos rendimentos brutos e a soma de: dedução
 *   específica (art. 25.º, n.º 1, a) = 8,54 × IAS) ou, se superior, as
 *   contribuições obrigatórias; **4 % do VPT** dos imóveis afetos a AL de que
 *   se seja proprietário; e despesas comunicadas no e-fatura. Não se aplica à
 *   alínea h) nem à a).
 * - **art. 28.º, n.º 14** (Lei 42/2016): quem explora AL em moradia ou
 *   apartamento pode, **a cada ano**, optar pelas regras da categoria F.
 * - **art. 41.º, n.º 1** (Lei 56/2023): na F deduzem-se os gastos suportados
 *   para obter o rendimento, exceto financeiros, depreciações, mobiliário,
 *   eletrodomésticos, artigos de conforto ou decoração e AIMI.
 * - **art. 72.º, n.º 1, e)**: rendimentos prediais que não sejam de
 *   arrendamento habitacional — é o caso do AL — à taxa autónoma de **28 %**
 *   (os 25 % do n.º 2 são só para arrendamento habitacional). Pode optar-se
 *   pelo englobamento.
 * - **art. 68.º** (Lei 73-A/2025): escalões de 2026. **art. 68.º-A**: taxa
 *   adicional de solidariedade. **art. 69.º**: quociente conjugal.
 * - IAS 2026 = 537,13 € (Portaria n.º 480-A/2025/1).
 *
 * O que **não** está aqui, e está dito ao anfitrião: Segurança Social (só
 * existe na B), deduções à coleta e mínimo de existência (mexem pouco na
 * diferença entre opções), e o efeito em mais-valias de o imóvel ficar afeto
 * a uma atividade empresarial. É uma simulação para levar ao contabilista,
 * não um cálculo de liquidação.
 */

export type ModalidadeAl = 'moradia' | 'apartamento' | 'hospedagem' | 'quartos'

export const MODALIDADE_LABEL: Record<ModalidadeAl, string> = {
  moradia: 'Moradia',
  apartamento: 'Apartamento',
  hospedagem: 'Estabelecimento de hospedagem',
  quartos: 'Quartos',
}

interface Escalao {
  ate: number
  taxa: number
}

export interface ParametrosAno {
  ano: number
  ias: number
  fonteIas: string
  escaloes: Escalao[]
  taxaAutonomaF: number
}

/** 2026 — art. 68.º na redação da Lei 73-A/2025; IAS pela Portaria 480-A/2025/1. */
export const PARAMETROS_2026: ParametrosAno = {
  ano: 2026,
  ias: 537.13,
  fonteIas: 'Portaria n.º 480-A/2025/1',
  escaloes: [
    { ate: 8342, taxa: 0.125 },
    { ate: 12587, taxa: 0.157 },
    { ate: 17838, taxa: 0.212 },
    { ate: 23089, taxa: 0.241 },
    { ate: 29397, taxa: 0.311 },
    { ate: 43090, taxa: 0.349 },
    { ate: 46566, taxa: 0.431 },
    { ate: 86634, taxa: 0.446 },
    { ate: Infinity, taxa: 0.48 },
  ],
  taxaAutonomaF: 0.28,
}

export const PARAMETROS: Record<number, ParametrosAno> = { 2026: PARAMETROS_2026 }

/** Parâmetros do ano, ou `null` se não estiverem verificados — nunca se inventa um ano. */
export function parametrosDoAno(ano: number): ParametrosAno | null {
  return PARAMETROS[ano] ?? null
}

/** Coeficiente do art. 31.º, n.º 1, com a alínea que o justifica. */
export function coeficiente(
  modalidade: ModalidadeAl,
  areaContencao: boolean,
): { valor: number; alinea: 'a' | 'c' | 'h' } {
  if (modalidade === 'hospedagem' || modalidade === 'quartos') return { valor: 0.15, alinea: 'a' }
  if (areaContencao) return { valor: 0.5, alinea: 'h' }
  return { valor: 0.35, alinea: 'c' }
}

export const podeOptarPelaF = (m: ModalidadeAl) => m === 'moradia' || m === 'apartamento'

/** Só o art. 68.º (escalões), sem quociente conjugal nem solidariedade. */
export function coletaEscaloes(rc: number, p: ParametrosAno): number {
  let coleta = 0
  let anterior = 0
  for (const e of p.escaloes) {
    if (rc <= anterior) break
    coleta += (Math.min(rc, e.ate) - anterior) * e.taxa
    anterior = e.ate
  }
  return coleta
}

/** Só o art. 68.º-A: 2,5 % de 80 000 a 250 000 €; 5 % acima. */
export function taxaSolidariedade(rc: number): number {
  return Math.max(0, Math.min(rc, 250_000) - 80_000) * 0.025 + Math.max(0, rc - 250_000) * 0.05
}

/** Coleta dos arts. 68.º e 68.º-A, com quociente conjugal (art. 69.º e 68.º-A, n.º 3). */
export function coletaIrs(rendimentoColetavel: number, conjunta: boolean, p: ParametrosAno): number {
  const rc = Math.max(0, rendimentoColetavel)
  if (conjunta) return 2 * coletaIrs(rc / 2, false, p)
  return coletaEscaloes(rc, p) + taxaSolidariedade(rc)
}

export interface AlojamentoFiscal {
  id: string
  nome: string
  modalidade: ModalidadeAl
  areaContencao: boolean
  /** VPT do imóvel, se o anfitrião for proprietário/usufrutuário. */
  vpt: number | null
  receita: number
  /** Despesas do ano afetas a este alojamento (sem IVA entregue ao Estado). */
  despesas: number
}

export interface Agregado {
  /** Rendimento coletável do agregado **sem** o AL (salários, pensões… já deduzidos). */
  outrosRendimentos: number
  conjunta: boolean
  /** Contribuições obrigatórias para a Segurança Social conexas com o AL. */
  contribuicoesSs: number
  /** `true` se as despesas estão no e-fatura afetas à atividade (n.º 13, e)). */
  despesasNoEfatura: boolean
}

export interface ResultadoB {
  rendimento: number
  base: number
  acrescimoN13: number
  receitaAlineaC: number
  justificadoN13: number
  imposto: number
}

export interface ResultadoF {
  disponivel: boolean
  rendimentoF: number
  prejuizoF: number
  rendimentoBRestante: number
  impostoAutonomo: number
  impostoEnglobado: number
  imposto: number
  modo: 'autonoma' | 'englobamento'
}

export interface MapaFiscal {
  ano: number
  receitaTotal: number
  b: ResultadoB
  f: ResultadoF
  /** Positivo = a F poupa este valor face à B. */
  poupancaF: number
  recomendacao: 'B' | 'F' | 'indiferente'
  avisos: string[]
}

function categoriaB(
  alojamentos: AlojamentoFiscal[],
  agregado: Agregado,
  p: ParametrosAno,
): Omit<ResultadoB, 'imposto'> {
  let base = 0
  let receitaC = 0
  let justificado = 0
  for (const a of alojamentos) {
    const c = coeficiente(a.modalidade, a.areaContencao)
    base += c.valor * a.receita
    if (c.alinea === 'c') {
      receitaC += a.receita
      justificado += 0.04 * (a.vpt ?? 0)
      if (agregado.despesasNoEfatura) justificado += a.despesas
    }
  }
  if (receitaC > 0) {
    const deducaoEspecifica = 8.54 * p.ias
    justificado += Math.max(deducaoEspecifica, agregado.contribuicoesSs)
  }
  const acrescimo = receitaC > 0 ? Math.max(0, 0.15 * receitaC - justificado) : 0
  return {
    rendimento: base + acrescimo,
    base,
    acrescimoN13: acrescimo,
    receitaAlineaC: receitaC,
    justificadoN13: receitaC > 0 ? justificado : 0,
  }
}

const incremental = (extra: number, agregado: Agregado, p: ParametrosAno) =>
  coletaIrs(agregado.outrosRendimentos + extra, agregado.conjunta, p) -
  coletaIrs(agregado.outrosRendimentos, agregado.conjunta, p)

export function mapaFiscal(
  alojamentos: AlojamentoFiscal[],
  agregado: Agregado,
  p: ParametrosAno,
): MapaFiscal {
  const avisos: string[] = []
  const receitaTotal = alojamentos.reduce((s, a) => s + a.receita, 0)

  const rb = categoriaB(alojamentos, agregado, p)
  const b: ResultadoB = { ...rb, imposto: incremental(rb.rendimento, agregado, p) }

  // Opção F: os alojamentos em moradia/apartamento passam para a F; os
  // restantes (hospedagem, quartos) ficam na B. O n.º 13 recalcula-se sobre o
  // que ficar na alínea c) — que, depois da opção, é nada.
  const paraF = alojamentos.filter(a => podeOptarPelaF(a.modalidade))
  const ficamB = alojamentos.filter(a => !podeOptarPelaF(a.modalidade))
  let f: ResultadoF
  if (paraF.length === 0) {
    f = {
      disponivel: false, rendimentoF: 0, prejuizoF: 0, rendimentoBRestante: b.rendimento,
      impostoAutonomo: 0, impostoEnglobado: 0, imposto: b.imposto, modo: 'autonoma',
    }
  } else {
    const liquido = paraF.reduce((s, a) => s + a.receita - a.despesas, 0)
    const rendimentoF = Math.max(0, liquido)
    const restante = categoriaB(ficamB, agregado, p).rendimento
    const impostoB = incremental(restante, agregado, p)
    const autonomo = impostoB + rendimentoF * p.taxaAutonomaF
    const englobado = incremental(restante + rendimentoF, agregado, p)
    const modo = englobado < autonomo ? 'englobamento' : 'autonoma'
    f = {
      disponivel: true,
      rendimentoF,
      prejuizoF: Math.max(0, -liquido),
      rendimentoBRestante: restante,
      impostoAutonomo: autonomo,
      impostoEnglobado: englobado,
      imposto: Math.min(autonomo, englobado),
      modo,
    }
    if (liquido < 0) {
      avisos.push(
        'Na categoria F o resultado é negativo: não há imposto este ano e o prejuízo reporta aos anos seguintes (art. 55.º) — confirmar com o contabilista.',
      )
    }
  }

  const poupancaF = f.disponivel ? b.imposto - f.imposto : 0
  const recomendacao: MapaFiscal['recomendacao'] = !f.disponivel || Math.abs(poupancaF) < 50
    ? 'indiferente'
    : poupancaF > 0 ? 'F' : 'B'

  if (b.acrescimoN13 > 0) {
    avisos.push(
      agregado.despesasNoEfatura
        ? 'Na B, as despesas justificadas não chegam a 15 % da receita: a diferença soma-se ao rendimento (art. 31.º, n.º 13).'
        : 'Na B contou-se só a dedução específica e os 4 % do VPT: as despesas só entram no n.º 13 se estiverem no e-fatura afetas à atividade.',
    )
  }
  if (alojamentos.some(a => coeficiente(a.modalidade, a.areaContencao).alinea === 'c' && !a.vpt)) {
    avisos.push('Há alojamentos sem VPT: 4 % do VPT conta como despesa justificada na B (art. 31.º, n.º 13, d)) — preencher melhora o cálculo.')
  }
  if (f.disponivel) {
    avisos.push('Na F não são dedutíveis juros de empréstimos, depreciações, mobiliário, eletrodomésticos, decoração nem AIMI (art. 41.º). Se as despesas registadas incluírem algum destes, a F está otimista.')
  }
  avisos.push('Não inclui Segurança Social (só existe na B), deduções à coleta nem efeitos em mais-valias da afetação do imóvel à atividade. Levar ao contabilista antes de decidir.')

  return { ano: p.ano, receitaTotal, b, f, poupancaF, recomendacao, avisos }
}
