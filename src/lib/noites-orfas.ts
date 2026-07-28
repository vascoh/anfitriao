import { nights } from './utils'
import { addDays } from './reservations'
import type { Booking } from './types'

/**
 * Deteção de noites órfãs — buracos curtos no calendário entre duas reservas.
 *
 * Uma noite órfã é uma janela livre tão pequena que dificilmente se vende ao
 * preço normal: quase ninguém procura 1 ou 2 noites com datas fixas. Ou se
 * baixa o preço, ou se ajusta a estadia mínima, ou fica vazia. Detetá-las com
 * antecedência é das poucas ações de revenue management com efeito imediato
 * e sem precisar de dados de mercado.
 *
 * Lógica pura e testável: o cron (`/api/cron/noites-orfas`) só recolhe dados
 * e envia. Nada aqui lê a data do sistema — `hoje` é sempre injetado.
 */

/** Máximo de noites consecutivas livres para o buraco contar como órfão. */
export const MAX_NOITES_ORFAS = 2

/** Só interessam buracos dentro desta janela: mais longe ainda há tempo de encher. */
export const HORIZONTE_DIAS = 60

/** Abaixo disto já não vale a pena avisar — não há tempo de reagir. */
export const ANTECEDENCIA_MINIMA_DIAS = 2

export interface NoiteOrfa {
  propriedade_id: string
  /** Primeira noite livre (YYYY-MM-DD). */
  inicio: string
  /** Dia da saída — a manhã seguinte à última noite livre. */
  fim: string
  /** Número de noites livres (1 ou 2). */
  noites: number
  /** Dias entre hoje e o início do buraco. */
  antecedencia: number
}

/** Estados que não bloqueiam o calendário. */
function ocupaCalendario(b: Booking): boolean {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

/**
 * Encontra buracos curtos entre reservas consecutivas de uma propriedade.
 *
 * Só conta buracos *entre* duas reservas: uma disponibilidade aberta no fim do
 * calendário não é uma noite órfã, é inventário normal por vender.
 */
export function detetarNoitesOrfas(
  bookings: Booking[],
  propriedadeId: string,
  hoje: string,
  opts?: { maxNoites?: number; horizonte?: number; antecedenciaMinima?: number },
): NoiteOrfa[] {
  const maxNoites = opts?.maxNoites ?? MAX_NOITES_ORFAS
  const horizonte = opts?.horizonte ?? HORIZONTE_DIAS
  const antecedenciaMinima = opts?.antecedenciaMinima ?? ANTECEDENCIA_MINIMA_DIAS

  const limite = addDays(hoje, horizonte)

  const relevantes = bookings
    .filter(b => b.propriedade_id === propriedadeId && ocupaCalendario(b))
    // Já terminadas não interessam; interessa o que ainda está por vir
    .filter(b => b.check_out >= hoje)
    .sort((a, b) => (a.check_in < b.check_in ? -1 : a.check_in > b.check_in ? 1 : 0))

  const orfas: NoiteOrfa[] = []

  for (let i = 0; i < relevantes.length - 1; i++) {
    const atual = relevantes[i]
    const seguinte = relevantes[i + 1]

    // Reservas sobrepostas ou encostadas não deixam buraco
    if (seguinte.check_in <= atual.check_out) continue

    const inicio = atual.check_out
    const fim = seguinte.check_in
    const noites = nights(inicio, fim)

    if (noites < 1 || noites > maxNoites) continue
    if (inicio > limite) continue

    const antecedencia = nights(hoje, inicio)
    if (antecedencia < antecedenciaMinima) continue

    orfas.push({ propriedade_id: propriedadeId, inicio, fim, noites, antecedencia })
  }

  return orfas
}

/** Corre a deteção para várias propriedades de uma vez. */
export function detetarTodasNoitesOrfas(
  bookings: Booking[],
  propriedadeIds: string[],
  hoje: string,
  opts?: Parameters<typeof detetarNoitesOrfas>[3],
): NoiteOrfa[] {
  return propriedadeIds.flatMap(id => detetarNoitesOrfas(bookings, id, hoje, opts))
}

/**
 * Desconto sugerido para uma noite órfã.
 *
 * Quanto mais perto está a data e mais curto é o buraco, mais agressivo tem de
 * ser: uma noite isolada daqui a 5 dias só se vende com incentivo real. Os
 * valores são heurísticos e deliberadamente conservadores — servem de ponto de
 * partida para o anfitrião, não de verdade absoluta. Quando existir o motor de
 * revenue management com dados próprios (ANF-6.4), isto passa a ser calculado.
 */
export function descontoSugerido(orfa: NoiteOrfa): number {
  let pct = orfa.noites === 1 ? 15 : 10

  if (orfa.antecedencia <= 7) pct += 10
  else if (orfa.antecedencia <= 21) pct += 5

  return Math.min(pct, 30)
}
