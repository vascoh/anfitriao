import { nights } from './utils'
import type { Booking, Guest, Property } from './types'

/**
 * Mapa mensal para o IPHH — Inquérito à Permanência de Hóspedes na Hotelaria
 * e Alojamento Local (INE).
 *
 * Obrigação: resposta mensal até ao dia 10 do mês seguinte, na plataforma
 * WebInq, mesmo quando não houve movimento (Lei 22/2008, Sistema Estatístico
 * Nacional).
 *
 * Definições do INE, seguidas à letra aqui:
 * - **Hóspede**: indivíduo que passa pelo menos uma noite no estabelecimento.
 *   Conta-se **na entrada**, ou seja, no mês do check-in.
 * - **Dormida**: permanência de um indivíduo por uma noite. Uma estadia de 3
 *   noites com 2 pessoas são 6 dormidas, repartidas pelo mês em que cada
 *   noite ocorre.
 *
 * ⚠️ O INE pede **país de residência**, que não é o mesmo que nacionalidade.
 * A aplicação só recolhe nacionalidade (é o campo do boletim SIBA), por isso
 * é usada como aproximação e a interface diz isso ao anfitrião. Quem tem
 * hóspedes residentes num país diferente do da nacionalidade tem de corrigir
 * à mão antes de submeter.
 */

/** Rótulo usado quando não há nacionalidade registada. */
export const PAIS_DESCONHECIDO = 'Não especificado'

export interface LinhaIne {
  pais: string
  /** Hóspedes entrados no mês (soma de `num_hospedes` dos check-ins). */
  hospedes: number
  /** Dormidas ocorridas no mês (pessoas × noites dentro do mês). */
  dormidas: number
}

export interface MapaIne {
  ano: number
  /** 0–11. */
  mes: number
  linhas: LinhaIne[]
  totalHospedes: number
  totalDormidas: number
  /** Estadia média em noites, arredondada a uma casa decimal. */
  estadiaMedia: number
  /** True quando não houve movimento — mesmo assim é obrigatório responder. */
  semMovimento: boolean
}

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
 * Noites de uma reserva que caem dentro do mês.
 * Uma estadia 30/jul→2/ago tem 2 noites em julho e 2 em agosto.
 */
export function noitesNoMes(b: Booking, ano: number, mes: number): number {
  const inicio = primeiroDia(ano, mes)
  const fim = primeiroDiaSeguinte(ano, mes)

  const de = b.check_in > inicio ? b.check_in : inicio
  const ate = b.check_out < fim ? b.check_out : fim

  return Math.max(0, nights(de, ate))
}

export function gerarMapaIne(
  bookings: Booking[],
  guests: Guest[],
  properties: Property[],
  ano: number,
  mes: number,
  opts?: { propriedadeId?: string },
): MapaIne {
  const inicio = primeiroDia(ano, mes)
  const fim = primeiroDiaSeguinte(ano, mes)

  const idsValidos = new Set(
    properties
      .filter(p => !opts?.propriedadeId || p.id === opts.propriedadeId)
      .map(p => p.id),
  )

  const porPais = new Map<string, LinhaIne>()

  function linha(pais: string): LinhaIne {
    let l = porPais.get(pais)
    if (!l) {
      l = { pais, hospedes: 0, dormidas: 0 }
      porPais.set(pais, l)
    }
    return l
  }

  for (const b of bookings) {
    if (!conta(b)) continue
    if (!idsValidos.has(b.propriedade_id)) continue

    // Fora do mês por completo
    if (b.check_in >= fim || b.check_out <= inicio) continue

    const hospede = guests.find(g => g.id === b.hospede_id)
    const pais = hospede?.nacionalidade?.trim() || PAIS_DESCONHECIDO
    const pessoas = Math.max(1, b.num_hospedes || 1)
    const l = linha(pais)

    // Hóspedes contam só no mês da entrada
    if (b.check_in >= inicio && b.check_in < fim) {
      l.hospedes += pessoas
    }

    l.dormidas += pessoas * noitesNoMes(b, ano, mes)
  }

  const linhas = [...porPais.values()]
    .filter(l => l.hospedes > 0 || l.dormidas > 0)
    .sort((a, b) => b.dormidas - a.dormidas || a.pais.localeCompare(b.pais, 'pt-PT'))

  const totalHospedes = linhas.reduce((s, l) => s + l.hospedes, 0)
  const totalDormidas = linhas.reduce((s, l) => s + l.dormidas, 0)

  return {
    ano,
    mes,
    linhas,
    totalHospedes,
    totalDormidas,
    estadiaMedia: totalHospedes === 0 ? 0 : Math.round((totalDormidas / totalHospedes) * 10) / 10,
    semMovimento: totalHospedes === 0 && totalDormidas === 0,
  }
}

/** Prazo legal de submissão: dia 10 do mês seguinte ao de referência. */
export function prazoIne(ano: number, mes: number): string {
  const proximo = mes === 11 ? { ano: ano + 1, mes: 0 } : { ano, mes: mes + 1 }
  return `${proximo.ano}-${String(proximo.mes + 1).padStart(2, '0')}-10`
}
