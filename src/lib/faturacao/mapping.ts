import { nights, fmtDate, today as todayIso } from '../utils'
import { taxaIvaAlojamento, semIva, ISENCAO_TAXA_TURISTICA } from './iva'
import type { LinhaFatura, PedidoFatura, ClienteFatura } from './types'
import type { Booking, Guest, Property } from '../types'

/**
 * Constrói o pedido de fatura a partir de uma reserva.
 *
 * Os valores guardados no Anfitrião são **com IVA incluído** (é o que o hóspede
 * paga), por isso convertem-se aqui para base tributável. A taxa turística é
 * uma linha própria e isenta — misturá-la com o alojamento inflacionaria o IVA
 * liquidado.
 */

export interface ComponentesReserva {
  /** Valor do alojamento com IVA incluído. */
  alojamento: number
  /** Taxa de limpeza com IVA incluído, se cobrada. */
  limpeza?: number
  /** Taxa municipal turística cobrada ao hóspede. Não sujeita a IVA. */
  taxaTuristica?: number
}

/**
 * Decompõe `preco_total` nos seus componentes.
 *
 * A taxa de limpeza vem da propriedade e a taxa turística é calculada à parte,
 * por isso o alojamento é o que sobra. Nunca devolve alojamento negativo: se
 * os extras excederem o total (dados inconsistentes), o alojamento fica a zero
 * e quem chama tem de corrigir antes de emitir.
 */
export function decomporReserva(
  precoTotal: number,
  opts?: { limpeza?: number; taxaTuristica?: number },
): ComponentesReserva {
  const limpeza = opts?.limpeza ?? 0
  const taxaTuristica = opts?.taxaTuristica ?? 0
  const alojamento = Math.max(0, Math.round((precoTotal - limpeza - taxaTuristica) * 100) / 100)
  return {
    alojamento,
    ...(limpeza > 0 ? { limpeza } : {}),
    ...(taxaTuristica > 0 ? { taxaTuristica } : {}),
  }
}

/**
 * Linhas da fatura.
 *
 * ⚠️ A taxa de limpeza segue a mesma taxa do alojamento, por ser tratada como
 * parte do serviço de alojamento quando não é um serviço autónomo. Não é
 * pacífico entre contabilistas — quem tiver entendimento diferente deve
 * confirmar com o seu. O alojamento e a taxa turística têm base legal clara e
 * estão documentados em `iva.ts`.
 */
export function linhasDaReserva(
  componentes: ComponentesReserva,
  concelho: string | null | undefined,
  descricaoEstadia: string,
): LinhaFatura[] {
  const taxa = taxaIvaAlojamento(concelho)
  const linhas: LinhaFatura[] = []

  if (componentes.alojamento > 0) {
    linhas.push({
      nome: 'Alojamento',
      descricao: descricaoEstadia,
      precoUnitario: semIva(componentes.alojamento, taxa),
      quantidade: 1,
      taxaIva: taxa,
    })
  }

  if (componentes.limpeza && componentes.limpeza > 0) {
    linhas.push({
      nome: 'Taxa de limpeza',
      descricao: 'Limpeza final',
      precoUnitario: semIva(componentes.limpeza, taxa),
      quantidade: 1,
      taxaIva: taxa,
    })
  }

  if (componentes.taxaTuristica && componentes.taxaTuristica > 0) {
    linhas.push({
      nome: 'Taxa municipal turística',
      descricao: 'Taxa municipal turística',
      precoUnitario: componentes.taxaTuristica, // não sujeita a IVA
      quantidade: 1,
      taxaIva: 0,
      motivoIsencao: ISENCAO_TAXA_TURISTICA,
    })
  }

  return linhas
}

export function clienteDaReserva(hospede: Guest | null | undefined, fallback: string): ClienteFatura {
  return {
    nome: hospede?.nome?.trim() || fallback,
    email: hospede?.email ?? null,
    nif: hospede?.numero_documento ?? null,
    pais: hospede?.nacionalidade ?? null,
  }
}

export function descricaoEstadia(b: Booking, propriedade: Property): string {
  const n = nights(b.check_in, b.check_out)
  return `${propriedade.nome} · ${fmtDate(b.check_in)} a ${fmtDate(b.check_out)} · ${n} ${n === 1 ? 'noite' : 'noites'}`
}

/** Monta o pedido completo, pronto a entregar ao adaptador. */
export function pedidoDaReserva(
  b: Booking,
  propriedade: Property,
  hospede: Guest | null | undefined,
  componentes: ComponentesReserva,
  opts?: { data?: string; enviarPorEmail?: boolean; serieId?: string | null },
): PedidoFatura {
  return {
    tipo: 'invoice_receipt',
    cliente: clienteDaReserva(hospede, 'Consumidor final'),
    linhas: linhasDaReserva(componentes, propriedade.cidade, descricaoEstadia(b, propriedade)),
    data: opts?.data ?? b.check_out,
    referencia: b.id,
    enviarPorEmail: opts?.enviarPorEmail ?? Boolean(hospede?.email),
    ...(opts?.serieId ? { serieId: opts.serieId } : {}),
  }
}

/**
 * Linhas de uma reserva de grupo — uma casa alugada por inteiro.
 *
 * Uma linha de alojamento **por quarto**, com o nome do quarto na descrição:
 * quem pagou 920 € pela casa quer ver de onde vieram, e o contabilista
 * também. As limpezas somam-se numa linha (é um serviço, não três) e a taxa
 * turística também, porque é por pessoa e por noite — soma-se por natureza.
 */
export function linhasDoGrupo(
  quartos: Array<{ nome: string; componentes: ComponentesReserva }>,
  concelho: string | null | undefined,
  descricaoEstadia: string,
): LinhaFatura[] {
  const taxa = taxaIvaAlojamento(concelho)
  const linhas: LinhaFatura[] = []

  for (const { nome, componentes } of quartos) {
    if (componentes.alojamento > 0) {
      linhas.push({
        nome: 'Alojamento',
        descricao: `${nome} · ${descricaoEstadia}`,
        precoUnitario: semIva(componentes.alojamento, taxa),
        quantidade: 1,
        taxaIva: taxa,
      })
    }
  }

  const limpeza = quartos.reduce((s, q) => s + (q.componentes.limpeza ?? 0), 0)
  if (limpeza > 0) {
    linhas.push({
      nome: 'Taxa de limpeza',
      descricao: 'Limpeza final',
      precoUnitario: semIva(limpeza, taxa),
      quantidade: 1,
      taxaIva: taxa,
    })
  }

  const tmt = quartos.reduce((s, q) => s + (q.componentes.taxaTuristica ?? 0), 0)
  if (tmt > 0) {
    linhas.push({
      nome: 'Taxa municipal turística',
      descricao: 'Taxa municipal turística',
      precoUnitario: Math.round(tmt * 100) / 100, // não sujeita a IVA
      quantidade: 1,
      taxaIva: 0,
      motivoIsencao: ISENCAO_TAXA_TURISTICA,
    })
  }

  return linhas
}

/**
 * Linhas da nota de crédito que anula uma fatura.
 *
 * São exatamente as mesmas da fatura original: uma nota de crédito parcial
 * exigiria decidir *o que* se devolve, e essa é uma decisão de negócio que o
 * anfitrião tem de tomar no programa de faturação, não um valor que se
 * adivinha a partir de um cancelamento.
 */
export function linhasDaNotaCredito(linhasOriginais: LinhaFatura[]): LinhaFatura[] {
  return linhasOriginais.map(l => ({ ...l }))
}

/** Monta a nota de crédito de uma reserva já faturada. */
export function pedidoDaNotaCredito(
  b: Booking,
  propriedade: Property,
  hospede: Guest | null | undefined,
  componentes: ComponentesReserva,
  opts?: { data?: string; serieId?: string | null; motivo?: string },
): PedidoFatura {
  return {
    tipo: 'credit_note',
    cliente: clienteDaReserva(hospede, 'Consumidor final'),
    linhas: linhasDaNotaCredito(
      linhasDaReserva(componentes, propriedade.cidade, descricaoEstadia(b, propriedade)),
    ),
    data: opts?.data ?? todayIso(),
    referencia: b.fatura_numero ? `Anula ${b.fatura_numero}` : b.id,
    observacoes: opts?.motivo ?? 'Anulação por cancelamento da reserva.',
    enviarPorEmail: false,
    ...(opts?.serieId ? { serieId: opts.serieId } : {}),
  }
}

/** Total com IVA de um conjunto de linhas — para conferir antes de emitir. */
export function totalComIva(linhas: LinhaFatura[]): number {
  const total = linhas.reduce(
    (s, l) => s + l.precoUnitario * l.quantidade * (1 + l.taxaIva / 100),
    0,
  )
  return Math.round(total * 100) / 100
}
