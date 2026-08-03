import { detectConflict } from './reservations'
import type { Booking, Property } from './types'

/**
 * Reservas de grupo — alugar uma casa inteira, de uma só vez.
 *
 * ## O problema
 *
 * Desde que uma casa com quartos deixou de ser uma unidade alugável (30/07),
 * ficou correto para os números e errado para as pessoas: quem quer levar um
 * grupo para a casa toda tinha de criar uma reserva por quarto, com o mesmo
 * hóspede e as mesmas datas, três vezes — e entre a primeira e a terceira
 * alguém podia ficar com um quarto.
 *
 * ## A decisão
 *
 * O grupo é **N reservas ligadas por `reserva_grupo_id`**, uma por quarto, e
 * não uma reserva na casa-mãe.
 *
 * Uma reserva na casa-mãe seria mais simples de criar e partiria tudo o resto:
 * a casa não é unidade alugável, logo a ocupação e o RevPAR dividiriam por um
 * denominador que não a inclui, o calendário de cada quarto não a mostraria, e
 * o feed iCal por quarto — que é como o Amenitiz e as plataformas leem a
 * disponibilidade — não a exportaria. Os quartos ficariam livres para toda a
 * gente menos para nós.
 *
 * Com N reservas ligadas, tudo o que já existe continua a funcionar sem saber
 * que os grupos existem. O grupo é uma camada de apresentação e de transação,
 * não um conceito novo no modelo.
 */

export interface QuartoDisponivel {
  quarto: Property
  livre: boolean
  /** Reserva que ocupa o quarto, quando não está livre. */
  conflito: Booking | null
}

/** Quartos ativos de uma casa. */
export function quartosDaCasa(propriedades: Property[], casaId: string): Property[] {
  return propriedades
    .filter(p => p.parent_id === casaId && p.ativo)
    .sort((a, b) => b.capacidade - a.capacidade || a.nome.localeCompare(b.nome, 'pt'))
}

/** True quando a propriedade é uma casa com quartos — o que se reserva em grupo. */
export function temQuartos(propriedades: Property[], casaId: string): boolean {
  return quartosDaCasa(propriedades, casaId).length > 0
}

/** Quantas pessoas leva a casa toda, somando os quartos. */
export function capacidadeTotal(quartos: Property[]): number {
  return quartos.reduce((s, q) => s + (q.capacidade ?? 0), 0)
}

/** Estado de cada quarto para um intervalo de datas. */
export function disponibilidadeDosQuartos(
  quartos: Property[],
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
): QuartoDisponivel[] {
  return quartos.map(quarto => {
    const conflito = detectConflict(bookings, quarto.id, checkIn, checkOut)
    return { quarto, livre: conflito === null, conflito }
  })
}

export type Sugestao =
  | { ok: true; quartos: Property[]; capacidade: number; sobra: number }
  | { ok: false; motivo: 'sem_quartos' | 'nao_cabe'; capacidadeDisponivel: number }

/**
 * Que quartos servem um grupo de N pessoas.
 *
 * Escolhe os maiores primeiro, para usar o menor número de quartos e deixar
 * os pequenos livres para outra reserva. Só considera quartos livres no
 * intervalo — sugerir um quarto ocupado seria oferecer uma reserva que vai
 * falhar a seguir.
 *
 * Devolve o motivo quando não dá, porque "não cabe" e "não há quartos livres
 * nessas datas" levam o anfitrião a fazer coisas diferentes.
 */
export function sugerirQuartos(disponiveis: QuartoDisponivel[], pessoas: number): Sugestao {
  const livres = disponiveis.filter(d => d.livre).map(d => d.quarto)
  const capacidadeDisponivel = capacidadeTotal(livres)

  if (livres.length === 0) {
    return { ok: false, motivo: 'sem_quartos', capacidadeDisponivel: 0 }
  }
  if (pessoas > capacidadeDisponivel) {
    return { ok: false, motivo: 'nao_cabe', capacidadeDisponivel }
  }

  const escolhidos: Property[] = []
  let porAlojar = pessoas

  for (const quarto of [...livres].sort((a, b) => b.capacidade - a.capacidade)) {
    if (porAlojar <= 0) break
    escolhidos.push(quarto)
    porAlojar -= quarto.capacidade
  }

  const capacidade = capacidadeTotal(escolhidos)
  return { ok: true, quartos: escolhidos, capacidade, sobra: capacidade - pessoas }
}

/**
 * Distribui as pessoas pelos quartos escolhidos.
 *
 * Enche os maiores primeiro. Serve para o `num_hospedes` de cada reserva ficar
 * certo — sem isso a ocupação por quarto mentiria, e os boletins do SIBA não
 * saberiam quantas pessoas dormiram em cada sítio.
 */
export function distribuirPessoas(quartos: Property[], pessoas: number): Map<string, number> {
  const mapa = new Map<string, number>()
  let restantes = pessoas

  for (const quarto of quartos) {
    const neste = Math.min(quarto.capacidade, Math.max(restantes, 0))
    mapa.set(quarto.id, neste)
    restantes -= neste
  }

  // Se ainda sobram pessoas, a capacidade não chegava — quem chama já devia
  // ter validado, mas não se perde ninguém em silêncio.
  if (restantes > 0 && quartos.length > 0) {
    const ultimo = quartos[quartos.length - 1]
    mapa.set(ultimo.id, (mapa.get(ultimo.id) ?? 0) + restantes)
  }

  return mapa
}

export interface ResumoGrupo {
  grupoId: string
  reservas: Booking[]
  casaId: string | null
  checkIn: string
  checkOut: string
  numHospedes: number
  precoTotal: number
  precoPago: number
  /** Um grupo com estados diferentes mostra o menos avançado. */
  estado: Booking['estado']
}

/** Ordem de "menos avançado" para decidir o estado que representa o grupo. */
const ORDEM_ESTADO: Booking['estado'][] = [
  'cancelada', 'no_show', 'pendente', 'confirmada', 'checkin', 'checkout',
]

/**
 * Agrupa reservas soltas em grupos, para a interface poder mostrar "uma
 * reserva" onde a base de dados tem três.
 *
 * Reservas sem grupo saem como grupos de uma — assim quem apresenta trata
 * tudo da mesma maneira, sem ramos por todo o lado.
 */
export function agruparReservas(bookings: Booking[]): ResumoGrupo[] {
  const porGrupo = new Map<string, Booking[]>()

  for (const b of bookings) {
    const chave = b.reserva_grupo_id ?? `solo:${b.id}`
    const lista = porGrupo.get(chave)
    if (lista) lista.push(b)
    else porGrupo.set(chave, [b])
  }

  return [...porGrupo.entries()].map(([grupoId, reservas]) => {
    const ordenadas = [...reservas].sort((a, b) => a.check_in.localeCompare(b.check_in))
    return {
      grupoId,
      reservas: ordenadas,
      casaId: null,
      checkIn: ordenadas[0].check_in,
      checkOut: ordenadas.reduce((max, b) => (b.check_out > max ? b.check_out : max), ordenadas[0].check_out),
      numHospedes: reservas.reduce((s, b) => s + (b.num_hospedes ?? 0), 0),
      precoTotal: Math.round(reservas.reduce((s, b) => s + (b.preco_total ?? 0), 0) * 100) / 100,
      precoPago: Math.round(reservas.reduce((s, b) => s + (b.preco_pago ?? 0), 0) * 100) / 100,
      estado: reservas
        .map(b => b.estado)
        .sort((a, b) => ORDEM_ESTADO.indexOf(a) - ORDEM_ESTADO.indexOf(b))[0],
    }
  })
}

/** True quando o grupo tem mais do que uma reserva — ou seja, é mesmo um grupo. */
export function eGrupo(r: ResumoGrupo): boolean {
  return r.reservas.length > 1
}
