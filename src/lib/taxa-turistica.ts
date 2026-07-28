import { addDays } from './reservations'
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
  /** Valor por pessoa por noite quando não há sazonalidade. */
  valor?: number
  /** Épocas com valores diferentes. Fora das épocas listadas não se cobra. */
  estacoes?: Estacao[]
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
]

export function regraPara(concelho: string | null | undefined): RegraTmt | null {
  if (!concelho) return null
  const alvo = concelho.trim().toLowerCase()
  return REGRAS_TMT.find(r => r.concelho.toLowerCase() === alvo) ?? null
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
  if (regra.estacoes) {
    const mesDia = dataIso.slice(5, 10)
    return regra.estacoes.find(e => dentroDaEstacao(mesDia, e))?.valor ?? 0
  }
  return regra.valor ?? 0
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
      noitesIsentas++
    }

    noite = addDays(noite, 1)
    indice++
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
