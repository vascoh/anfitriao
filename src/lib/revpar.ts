import { unidadesReservaveis } from './reservations'
import type { Booking, Property } from './types'

/**
 * RevPAR — receita por unidade disponível e por noite.
 *
 * É a métrica que responde a "vale a pena baixar o preço para encher?", e por
 * isso só serve se as duas metades da fração falarem do mesmo período.
 *
 * ## O que estava errado
 *
 * O denominador do ano em curso contava **os dias já passados** (bem visto: o
 * ano ainda não acabou), mas o numerador somava **todas as reservas do ano**,
 * incluindo as que ainda vão acontecer. Em janeiro, uma reserva de dezembro
 * já paga entrava a dividir por 20 dias: um RevPAR várias vezes acima do
 * real, precisamente no mês em que o anfitrião está a decidir os preços da
 * época. Agora, no ano em curso, só entra o que já foi ocupado.
 *
 * ## Anos bissextos
 *
 * A regra era `ano % 4`, que erra em 1900 e 2100. É irrelevante para o
 * produto e demora uma linha a fazer bem — não vale a pena deixar uma
 * fórmula errada à espera de quem a copie para outro sítio.
 */

export function eBissexto(ano: number): boolean {
  return ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
}

export function diasDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
}

/**
 * Dias do período a considerar no denominador.
 *
 * Para o ano em curso conta só até hoje (inclusive): dividir por 365 em
 * janeiro daria um RevPAR perto de zero e ninguém decidiria nada com ele.
 */
export function diasDoPeriodo(ano: number, hoje: string, mes?: number): number {
  if (mes !== undefined) return diasDoMes(ano, mes)

  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number)
  if (ano > anoHoje) return 0
  if (ano < anoHoje) return eBissexto(ano) ? 366 : 365

  let dias = diaHoje
  for (let m = 0; m < mesHoje - 1; m++) dias += diasDoMes(ano, m)
  return dias
}

function contaParaReceita(b: Booking): boolean {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

export function calcularRevPar(p: {
  bookings: Booking[]
  properties: Property[]
  ano: number
  hoje: string
  /** 0–11; ausente = ano inteiro. */
  mes?: number
}): number {
  const unidades = unidadesReservaveis(p.properties)
  if (unidades.length === 0) return 0

  const dias = diasDoPeriodo(p.ano, p.hoje, p.mes)
  const noitesDisponiveis = unidades.length * dias
  if (noitesDisponiveis <= 0) return 0

  const idsUnidades = new Set(unidades.map(u => u.id))
  const prefixo = p.mes !== undefined
    ? `${p.ano}-${String(p.mes + 1).padStart(2, '0')}`
    : String(p.ano)

  const receita = p.bookings
    .filter(b => {
      if (!contaParaReceita(b)) return false
      // Só o que se aluga: uma casa-mãe não entra no denominador, logo também
      // não pode entrar no numerador.
      if (!idsUnidades.has(b.propriedade_id)) return false
      if (!b.check_in.startsWith(prefixo)) return false
      // No ano em curso, o que ainda não começou não conta — ver a nota acima.
      return b.check_in <= p.hoje
    })
    .reduce((s, b) => s + (b.preco_total ?? 0), 0)

  return Math.round(receita / noitesDisponiveis)
}
