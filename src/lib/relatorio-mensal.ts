import { occupancyForMonth, unidadesReservaveis } from './reservations'
import type { Booking, Property } from './types'

/**
 * Resumo mensal do desempenho de uma conta.
 *
 * É a peça de retenção mais barata que existe: chega por email no dia 1, sem
 * o anfitrião ter de abrir nada, e é o artefacto que ele reencaminha ao
 * contabilista. Lógica pura — o cron só recolhe e envia.
 */

export interface ResumoMensal {
  ano: number
  /** 0–11, como no `Date` do JavaScript. */
  mes: number
  receita: number
  /** Noites vendidas no mês. */
  noites: number
  /** Noites disponíveis (dias do mês × alojamentos ativos). */
  noitesDisponiveis: number
  ocupacaoPct: number
  /** Average Daily Rate — receita por noite vendida. */
  adr: number
  /** Revenue per Available Room — receita por noite disponível. */
  revpar: number
  reservas: number
  /** Receita por origem, ordenada da maior para a menor. */
  porOrigem: Array<{ origem: string; valor: number }>
}

/** Estados que não contam para receita nem ocupação. */
function conta(b: Booking): boolean {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

function primeiroDia(ano: number, mes: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-01`
}

function primeiroDiaSeguinte(ano: number, mes: number): string {
  return mes === 11 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 2).padStart(2, '0')}-01`
}

/**
 * Calcula o resumo de um mês.
 *
 * A receita é atribuída ao mês do check-in — é o critério que o anfitrião
 * reconhece ("quanto entrou em julho"), e o mesmo que o financeiro já usa.
 * Estadias que atravessam meses contam inteiras no mês de chegada.
 */
export function resumoMensal(
  bookings: Booking[],
  properties: Property[],
  ano: number,
  mes: number,
): ResumoMensal {
  const inicio = primeiroDia(ano, mes)
  const fim = primeiroDiaSeguinte(ano, mes)

  // Só o que se aluga: uma casa com quartos é o contentor deles, e contá-la
  // como unidade diluiria a ocupação e o RevPAR com noites que não existem.
  const ativas = unidadesReservaveis(properties)
  const doMes = bookings.filter(b => conta(b) && b.check_in >= inicio && b.check_in < fim)

  const receita = doMes.reduce((s, b) => s + (b.preco_total || 0), 0)

  const ocupacoes = ativas.map(p => occupancyForMonth(bookings, p.id, ano, mes))
  const noites = ocupacoes.reduce((s, o) => s + o.occupied, 0)
  const noitesDisponiveis = ocupacoes.reduce((s, o) => s + o.total, 0)

  const porOrigemMap = new Map<string, number>()
  for (const b of doMes) {
    porOrigemMap.set(b.origem, (porOrigemMap.get(b.origem) ?? 0) + (b.preco_total || 0))
  }

  return {
    ano,
    mes,
    receita,
    noites,
    noitesDisponiveis,
    ocupacaoPct: noitesDisponiveis === 0 ? 0 : Math.round((noites / noitesDisponiveis) * 100),
    adr: noites === 0 ? 0 : Math.round(receita / noites),
    revpar: noitesDisponiveis === 0 ? 0 : Math.round(receita / noitesDisponiveis),
    reservas: doMes.length,
    porOrigem: [...porOrigemMap.entries()]
      .map(([origem, valor]) => ({ origem, valor }))
      .filter(o => o.valor > 0)
      .sort((a, b) => b.valor - a.valor),
  }
}

/** Mês anterior a uma data YYYY-MM-DD, como par {ano, mes}. */
export function mesAnterior(iso: string): { ano: number; mes: number } {
  const ano = Number(iso.slice(0, 4))
  const mes = Number(iso.slice(5, 7)) - 1 // 0-indexed
  return mes === 0 ? { ano: ano - 1, mes: 11 } : { ano, mes: mes - 1 }
}

/** Variação percentual entre dois valores. `null` quando não há base de comparação. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function nomeMes(mes: number): string {
  return MESES[mes] ?? ''
}
