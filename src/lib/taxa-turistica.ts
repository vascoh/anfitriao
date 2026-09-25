import { addDays } from './reservations'
import { chaveDeConcelho } from './concelhos'
import type { Booking } from './types'

/**
 * Taxa Municipal Turística (TMT).
 *
 * A TMT é criada por regulamento de cada município, não por lei nacional.
 * Isto significa que **não há uma regra única**: valor, sazonalidade, limite
 * de noites e isenções mudam de concelho para concelho, e mudam ao longo do
 * tempo sem aviso central.
 *
 * ⚠️ REGRA DESTE FICHEIRO: só entra aqui um concelho para o qual exista fonte
 * datada e coerente. Ao investigar (2026-07-28) encontrei fontes públicas em
 * contradição direta — por exemplo Faro descrito como €1,50/noite sem
 * sazonalidade numa fonte e €2/€1 sazonal noutra, e Loulé como €2 fixo numa e
 * €1/€2 sazonal noutra. Nesses casos o concelho **fica de fora** em vez de
 * entrar com um palpite: cobrar a mais ao hóspede ou declarar a menos ao
 * município são ambos danos reais.
 *
 * Concelho não configurado devolve `null` e a interface diz "não configurado",
 * nunca zero — zero seria indistinguível de "isento".
 */

export interface Estacao {
  /** Mês-dia de início, formato MM-DD (inclusive). */
  de: string
  /** Mês-dia de fim, formato MM-DD (inclusive). */
  ate: string
  valor: number
}

export interface RegraTmt {
  /** Nome do concelho, como aparece em `properties.cidade`. */
  concelho: string
  /** Outras formas comuns do nome (ex.: «Gaia»). Nunca um nome que seja de outro concelho. */
  aliases?: string[]
  /**
   * Primeira noite para a qual o valor foi verificado (YYYY-MM-DD). Antes
   * disso o regulamento pode ter tido outros valores que não confirmámos: o
   * cálculo continua, mas avisa — em vez de aplicar calado um valor que
   * pode estar errado.
   */
  valoresDesde?: string
  /** Valor por pessoa por noite quando não há sazonalidade. */
  valor?: number
  /** Épocas com valores diferentes. Fora das épocas listadas não se cobra. */
  estacoes?: Estacao[]
  /**
   * Alterações ao valor ao longo do tempo, por ordem de `desde` (YYYY-MM-DD).
   * Cada noite usa a última alteração com `desde` <= noite; antes da primeira,
   * vale `valor`/`estacoes`. Sem isto, uma subida a meio do ano (Gaia, 21/08/2026)
   * recalculava as estadias de julho ao valor novo — e o mapa mensal declarava
   * ao município mais do que foi cobrado ao hóspede.
   */
  alteracoes?: Array<{ desde: string; valor?: number; estacoes?: Estacao[] }>
  /** Máximo de noites cobradas por estadia. */
  maxNoites: number
  /** Idade abaixo da qual o hóspede está isento (ex.: 13 = isentos os menores de 13). */
  isencaoIdade: number
  fonte: string
  /** Data em que a regra foi verificada (YYYY-MM-DD). */
  verificadoEm: string
}

/**
 * Regras verificadas. Fonte principal: guia da ALerta, atualizado a
 * 2026-07-13, por ser o único encontrado com valor, sazonalidade, limite de
 * noites e isenções coerentes entre si para os mesmos concelhos.
 *
 * Ao acrescentar um concelho: confirmar no **regulamento municipal**, não em
 * blogues, e preencher `fonte` e `verificadoEm`.
 */
export const REGRAS_TMT: RegraTmt[] = [
  {
    concelho: 'Lisboa',
    valor: 4,
    maxNoites: 7,
    isencaoIdade: 13,
    fonte: 'Regulamento da Taxa Municipal Turística de Lisboa',
    verificadoEm: '2026-07-28',
  },
  {
    concelho: 'Porto',
    valor: 3,
    maxNoites: 7,
    isencaoIdade: 13,
    fonte: 'Regulamento da Taxa Municipal Turística do Porto',
    verificadoEm: '2026-07-28',
  },
  {
    concelho: 'Cascais',
    valor: 4,
    maxNoites: 7,
    isencaoIdade: 13,
    fonte: 'Regulamento da Taxa Municipal Turística de Cascais',
    verificadoEm: '2026-07-28',
  },
  {
    concelho: 'Albufeira',
    // Só se cobra de abril a outubro; fora disso não há taxa
    estacoes: [{ de: '04-01', ate: '10-31', valor: 2 }],
    maxNoites: 7,
    isencaoIdade: 13,
    // Revisão do regulamento em curso desde fev/2026 (cm-albufeira.pt), ainda sem texto novo publicado
    fonte: 'Regulamento da Taxa Municipal Turística de Albufeira',
    verificadoEm: '2026-07-28',
  },
  {
    concelho: 'Loulé',
    estacoes: [
      { de: '04-01', ate: '10-31', valor: 2 },
      { de: '11-01', ate: '03-31', valor: 1 },
    ],
    maxNoites: 5,
    isencaoIdade: 16,
    fonte: 'Regulamento da Taxa Municipal Turística de Loulé',
    verificadoEm: '2026-07-28',
  },
  {
    concelho: 'Faro',
    // 1 mar-31 out: época alta; 1 nov-fim fev: época baixa
    estacoes: [
      { de: '03-01', ate: '10-31', valor: 2 },
      { de: '11-01', ate: '02-29', valor: 1 }, // '29' cobre também anos bissextos; nos outros o dia nunca existe
    ],
    maxNoites: 7,
    isencaoIdade: 16,
    fonte: 'Regulamento n.º 1207/2024, Diário da República 2.ª série n.º 205/2024 (22-10-2024), em vigor desde 01-11-2024 — art. 2.º (valor), art. 3.º (7 noites), art. 4.º (isenção 16 anos)',
    verificadoEm: '2026-09-17',
  },
  {
    concelho: 'Sintra',
    valor: 2,
    maxNoites: 3,
    isencaoIdade: 13,
    fonte: 'cm-sintra.pt/sintra/turismo/taxa-municipal-turistica — taxa em vigor desde 29-03-2023 (Assembleia Municipal, 17-02-2023): 2€/pessoa/dormida, máximo de 3 noites por estadia, isentos os menores de 13 anos',
    verificadoEm: '2026-09-17',
  },
  {
    concelho: 'Vila Nova de Gaia',
    aliases: ['Gaia'],
    valor: 2.5,
    alteracoes: [{ desde: '2026-08-21', valor: 3 }],
    maxNoites: 7,
    isencaoIdade: 16,
    valoresDesde: '2024-04-01',
    fonte: 'Regulamento n.º 195/2024, Diário da República 2.ª série n.º 31 (13-02-2024), art. 3.º: 2,5 €/dormida todo o ano, hóspedes com 16 anos ou mais, máximo de 7 noites seguidas; em vigor no 1.º dia do 2.º mês após publicação (01-04-2024). 3,00 € a partir de 21-08-2026 (3.ª alteração, Assembleia Municipal de 19-06-2026, taxadecidade.cm-gaia.pt)',
    verificadoEm: '2026-09-25',
  },
  {
    concelho: 'Braga',
    valor: 1.5,
    maxNoites: 4,
    isencaoIdade: 16,
    valoresDesde: '2025-07-30',
    fonte: 'Regulamento n.º 927/2025, Diário da República 2.ª série n.º 142 (25-07-2025), Título H-4: art. H-4/2.º (1,50 €/dormida), art. H-4/3.º n.º 2 (todo o ano, máximo 4 noites seguidas), art. H-4/4.º (hóspedes com 16 anos ou mais); em vigor no 5.º dia após publicação. Antes cobrava-se só na época alta — estadias anteriores não verificadas',
    verificadoEm: '2026-09-25',
  },
  {
    concelho: 'Portimão',
    estacoes: [
      { de: '04-01', ate: '10-31', valor: 2 },
      { de: '11-01', ate: '03-31', valor: 1 },
    ],
    maxNoites: 7,
    isencaoIdade: 13,
    valoresDesde: '2024-03-14',
    fonte: 'Aviso n.º 5384/2024/2, Diário da República 2.ª série n.º 52 (13-03-2024), Regulamento da Taxa Turística de Portimão: art. 3.º (2 € época alta 1/abr–31/out, 1 € época baixa 1/nov–31/mar), art. 4.º (máximo 7 noites seguidas), hóspedes com 13 anos ou mais; em vigor desde 14-03-2024 (cm-portimao.pt)',
    verificadoEm: '2026-09-25',
  },
  {
    concelho: 'Mafra',
    estacoes: [
      { de: '05-01', ate: '10-31', valor: 2.5 },
      { de: '11-01', ate: '04-30', valor: 1.2 },
    ],
    maxNoites: 7,
    isencaoIdade: 13,
    valoresDesde: '2026-01-01',
    fonte: 'Regulamento n.º 859-A/2018 (DR 2.ª série n.º 251, 31-12-2018), art. 3.º, alterado pelo Regulamento n.º 207/2023: época alta 1/mai–31/out, baixa 1/nov–30/abr, hóspedes com mais de 12 anos, máximo 7 noites; o valor tem atualização anual — 2,50 €/1,20 € com efeitos a 01-01-2026 (cm-mafra.pt/pages/1182). Parques de campismo e Tapada pagam metade (não modelado)',
    verificadoEm: '2026-09-25',
  },
  {
    concelho: 'Óbidos',
    valor: 1,
    maxNoites: 5,
    isencaoIdade: 13,
    valoresDesde: '2022-01-01',
    fonte: 'Regulamento da Taxa Municipal Turística de Óbidos, Diário da República 2.ª série n.º 219 (14-11-2018): máximo 5 noites consecutivas no mesmo estabelecimento (a interrupção reinicia a contagem); 1 €/hóspede/noite, hóspedes com 13 anos ou mais, em vigor desde 01-01-2022 (cm-obidos.pt)',
    verificadoEm: '2026-09-25',
  },
]

export function regraPara(concelho: string | null | undefined): RegraTmt | null {
  if (!concelho) return null
  const alvo = chaveDeConcelho(concelho)
  if (!alvo) return null
  return REGRAS_TMT.find(r =>
    chaveDeConcelho(r.concelho) === alvo || (r.aliases ?? []).some(a => chaveDeConcelho(a) === alvo),
  ) ?? null
}

/** True quando MM-DD cai dentro do intervalo, incluindo intervalos que passam o ano. */
export function dentroDaEstacao(mesDia: string, estacao: Estacao): boolean {
  const { de, ate } = estacao
  // Intervalo normal (ex.: 04-01 a 10-31)
  if (de <= ate) return mesDia >= de && mesDia <= ate
  // Intervalo que atravessa o ano (ex.: 11-01 a 03-31)
  return mesDia >= de || mesDia <= ate
}

/** Valor por pessoa aplicável a uma noite concreta. 0 quando não se cobra. */
export function valorDaNoite(regra: RegraTmt, dataIso: string): number {
  const noite = dataIso.slice(0, 10)
  const vigente = [...(regra.alteracoes ?? [])]
    .sort((a, b) => a.desde.localeCompare(b.desde))
    .filter(a => a.desde <= noite)
    .pop()
  const { valor, estacoes } = vigente ?? regra
  if (estacoes) {
    const mesDia = noite.slice(5, 10)
    return estacoes.find(e => dentroDaEstacao(mesDia, e))?.valor ?? 0
  }
  return valor ?? 0
}

export interface CalculoTmt {
  /** Noites da estadia que caem dentro do limite do regulamento. */
  noitesTributaveis: number
  /** Noites da estadia acima do limite, não cobradas. */
  noitesIsentas: number
  pessoasCobradas: number
  valor: number
  regra: RegraTmt
  /** Avisos a mostrar ao anfitrião antes de aceitar o valor. */
  avisos: string[]
}

/**
 * Calcula a TMT de uma reserva.
 *
 * `pessoasIsentas` permite descontar hóspedes abaixo da idade de isenção. A
 * aplicação **não sabe** a idade de cada hóspede (o boletim SIBA só recolhe a
 * data de nascimento do hóspede que faz o check-in), por isso este valor é
 * declarado pelo anfitrião. Quando fica a zero devolve-se um aviso, para o
 * anfitrião não declarar a mais sem dar por isso.
 *
 * Opcionalmente limita o cálculo a um mês (`ano`/`mes`), para o mapa mensal:
 * só contam as noites tributáveis que caem nesse mês.
 */
export function calcularTmt(
  b: Booking,
  regra: RegraTmt,
  opts?: { pessoasIsentas?: number; ano?: number; mes?: number },
): CalculoTmt {
  const avisos: string[] = []
  const pessoas = Math.max(1, b.num_hospedes || 1)
  const isentas = Math.min(Math.max(0, opts?.pessoasIsentas ?? 0), pessoas)
  const pessoasCobradas = pessoas - isentas

  // Filtro de mês, quando pedido
  const filtrarMes = opts?.ano !== undefined && opts?.mes !== undefined
  const inicioMes = filtrarMes
    ? `${opts!.ano}-${String(opts!.mes! + 1).padStart(2, '0')}-01`
    : null
  const fimMes = filtrarMes
    ? (opts!.mes === 11
        ? `${opts!.ano! + 1}-01-01`
        : `${opts!.ano}-${String(opts!.mes! + 2).padStart(2, '0')}-01`)
    : null

  let valor = 0
  let noitesTributaveis = 0
  let noitesIsentas = 0
  let noite = b.check_in
  let indice = 0

  // Percorre noite a noite: é a única forma correta com sazonalidade
  while (noite < b.check_out) {
    const dentroDoLimite = indice < regra.maxNoites
    const dentroDoMes = !filtrarMes || (noite >= inicioMes! && noite < fimMes!)

    if (dentroDoLimite) {
      if (dentroDoMes) {
        const porPessoa = valorDaNoite(regra, noite)
        if (porPessoa > 0) {
          valor += porPessoa * pessoasCobradas
          noitesTributaveis++
        }
      }
    } else if (dentroDoMes) {
      // Só conta como "isenta pelo limite" a noite que seria cobrada se o
      // limite não existisse — senão uma estadia inteira em época baixa
      // (0 € em qualquer caso) ganhava o aviso de "acima do limite", que é
      // falso: essas noites nunca iam ser cobradas, limite ou não.
      if (valorDaNoite(regra, noite) > 0) noitesIsentas++
    }

    noite = addDays(noite, 1)
    indice++
  }

  if (regra.valoresDesde && b.check_in < regra.valoresDesde) {
    avisos.push(
      `O valor da taxa de ${regra.concelho} só está verificado para noites a partir de ${regra.valoresDesde}. Confirma o valor que vigorava nas datas desta estadia.`,
    )
  }
  if (isentas === 0 && pessoas > 1) {
    avisos.push(
      `Menores de ${regra.isencaoIdade} anos estão isentos. Se houve crianças nesta reserva, ajusta o número de hóspedes isentos.`,
    )
  }
  if (noitesIsentas > 0) {
    avisos.push(
      `Estadia acima do limite de ${regra.maxNoites} noites — as noites seguintes não são cobradas.`,
    )
  }

  return {
    noitesTributaveis,
    noitesIsentas,
    pessoasCobradas,
    valor: Math.round(valor * 100) / 100,
    regra,
    avisos,
  }
}

export interface LinhaMapaTmt {
  bookingId: string
  propriedade: string
  concelho: string
  checkIn: string
  checkOut: string
  pessoas: number
  noites: number
  valor: number
}

export interface MapaTmt {
  ano: number
  mes: number
  linhas: LinhaMapaTmt[]
  total: number
  /** Concelhos das propriedades sem regra configurada. */
  concelhosPorConfigurar: string[]
}
