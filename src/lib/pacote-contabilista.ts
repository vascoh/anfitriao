/**
 * Resumo fiscal anual por estabelecimento de AL — alimenta o mapa IRS (B vs F)
 * e o pacote para o contabilista.
 *
 * Decisões, todas escritas no próprio CSV para o contabilista as ver:
 *
 * - **Estabelecimento = propriedade de topo.** O registo no RNAL é da casa; os
 *   quartos são unidades dela. Reservas e despesas de um quarto sobem para a
 *   casa.
 * - **Receita = `preco_total`** das reservas ativas com check-in no ano (o
 *   mesmo critério do `/financeiro`). A taxa municipal turística **não** está
 *   no `preco_total` — é cobrada à parte e entregue ao município — por isso
 *   não conta como rendimento. Se os preços incluem IVA, tira-se à taxa da
 *   região do concelho (`faturacao/iva.ts`).
 * - **Comissões**: as registadas como despesa `comissoes`; se um alojamento
 *   não tiver nenhuma no ano, usa-se a estimativa pelas taxas das plataformas
 *   e marca-se como estimada. Nunca as duas — seria contar duas vezes.
 * - **Despesas sem alojamento** (a luz da casa, o contabilista) repartem-se
 *   pela receita de cada alojamento.
 * - Despesas da categoria `iva` ficam de fora: IVA entregue ao Estado não é
 *   gasto em IRS.
 */

import { taxaIvaAlojamento, semIva } from './faturacao/iva'
import { geraObrigacoesDeHospede } from './reservations'
import { nights } from './utils'
import type { AlojamentoFiscal, ModalidadeAl } from './fiscal-irs'
import type { Booking, Expense, ExpenseCategoria, PlatformRate, Property } from './types'

export interface ResumoAlojamento {
  id: string
  nome: string
  cidade: string
  modalidade: ModalidadeAl | null
  areaContencao: boolean
  vpt: number | null
  reservas: number
  noites: number
  /** Soma de `preco_total` (o que o hóspede pagou, sem TMT). */
  receitaBruta: number
  /** Receita para IRS: sem IVA se os preços o incluírem. */
  receita: number
  taxaIva: number
  comissoes: number
  comissoesEstimadas: boolean
  despesasPorCategoria: Partial<Record<ExpenseCategoria, number>>
  /** Despesas não atribuídas, repartidas para este alojamento. */
  despesasRepartidas: number
  /** Total dedutível em IRS: despesas (sem `iva`) + comissões. */
  despesas: number
}

export interface LinhaReserva {
  alojamento: string
  unidade: string
  check_in: string
  check_out: string
  noites: number
  origem: string
  preco_total: number
  comissao_estimada: number
}

export interface ResumoAnual {
  ano: number
  precosComIva: boolean
  alojamentos: ResumoAlojamento[]
  reservas: LinhaReserva[]
  despesas: Array<Expense & { alojamento: string }>
  despesasNaoAtribuidas: number
}

const ativa = (b: Booking) => b.estado !== 'cancelada' && b.estado !== 'no_show'
const r2 = (v: number) => Math.round(v * 100) / 100

function comissaoEstimada(b: Booking, rates: PlatformRate[]): number {
  if (b.origem === 'direto' || b.preco_total <= 0) return 0
  const rate = rates.find(r => r.property_id === b.propriedade_id && r.plataforma === b.origem && r.ativo)
  return rate ? b.preco_total * (rate.comissao_pct / 100) : 0
}

/** Modalidade provável a partir do `tipo` do site — só como sugestão na página. */
export function modalidadeSugerida(p: Pick<Property, 'tipo'>): ModalidadeAl | null {
  if (p.tipo === 'apartamento') return 'apartamento'
  if (p.tipo === 'moradia') return 'moradia'
  if (p.tipo === 'quarto') return 'quartos'
  return null
}

export function resumoFiscalAnual(input: {
  ano: number
  bookings: Booking[]
  expenses: Expense[]
  properties: Property[]
  platformRates: PlatformRate[]
  precosComIva: boolean
}): ResumoAnual {
  const { ano, bookings, expenses, properties, platformRates, precosComIva } = input
  const prefixo = String(ano)
  const porId = new Map(properties.map(p => [p.id, p]))
  /** Propriedade de topo de uma unidade (a própria, se não for quarto). */
  const topo = (id: string | null | undefined): Property | undefined => {
    let p = id ? porId.get(id) : undefined
    for (let i = 0; p?.parent_id && i < 5; i++) p = porId.get(p.parent_id) ?? p
    return p
  }

  const casas = properties.filter(p => !p.parent_id)
  const resumo = new Map<string, ResumoAlojamento>()
  for (const c of casas) {
    resumo.set(c.id, {
      id: c.id, nome: c.nome, cidade: c.cidade ?? '',
      modalidade: c.al_modalidade ?? null,
      areaContencao: c.al_area_contencao === true,
      vpt: c.vpt ?? null,
      reservas: 0, noites: 0, receitaBruta: 0, receita: 0,
      taxaIva: precosComIva ? taxaIvaAlojamento(c.cidade) : 0,
      comissoes: 0, comissoesEstimadas: false,
      despesasPorCategoria: {}, despesasRepartidas: 0, despesas: 0,
    })
  }

  const reservas: LinhaReserva[] = []
  const estimadas = new Map<string, number>()
  for (const b of bookings) {
    if (!ativa(b) || !geraObrigacoesDeHospede(b) || !b.check_in.startsWith(prefixo)) continue
    const casa = topo(b.propriedade_id)
    const r = casa && resumo.get(casa.id)
    if (!r) continue
    const n = nights(b.check_in, b.check_out)
    const comissao = comissaoEstimada(b, platformRates)
    r.reservas += 1
    r.noites += n
    r.receitaBruta += b.preco_total
    estimadas.set(r.id, (estimadas.get(r.id) ?? 0) + comissao)
    reservas.push({
      alojamento: r.nome,
      unidade: porId.get(b.propriedade_id)?.nome ?? '',
      check_in: b.check_in, check_out: b.check_out, noites: n,
      origem: b.origem, preco_total: b.preco_total, comissao_estimada: r2(comissao),
    })
  }

  const despesas: ResumoAnual['despesas'] = []
  let naoAtribuidas = 0
  for (const e of expenses) {
    if (!e.data.startsWith(prefixo)) continue
    const casa = topo(e.propriedade_id)
    const r = casa && resumo.get(casa.id)
    despesas.push({ ...e, alojamento: r?.nome ?? '(sem alojamento)' })
    if (!r) {
      if (e.categoria !== 'iva') naoAtribuidas += e.valor
      continue
    }
    r.despesasPorCategoria[e.categoria] = (r.despesasPorCategoria[e.categoria] ?? 0) + e.valor
  }

  const lista = [...resumo.values()]
  for (const r of lista) {
    r.receita = r.taxaIva > 0 ? semIva(r.receitaBruta, r.taxaIva) : r.receitaBruta
    const registadas = r.despesasPorCategoria.comissoes ?? 0
    if (registadas > 0) {
      r.comissoes = registadas
    } else {
      r.comissoes = r2(estimadas.get(r.id) ?? 0)
      r.comissoesEstimadas = r.comissoes > 0
    }
  }

  const receitaTotal = lista.reduce((s, r) => s + r.receita, 0)
  for (const r of lista) {
    r.despesasRepartidas = receitaTotal > 0 ? r2(naoAtribuidas * (r.receita / receitaTotal)) : 0
    const semIvaNemComissoes = Object.entries(r.despesasPorCategoria)
      .filter(([c]) => c !== 'iva' && c !== 'comissoes')
      .reduce((s, [, v]) => s + (v ?? 0), 0)
    r.despesas = r2(semIvaNemComissoes + r.comissoes + r.despesasRepartidas)
    r.receitaBruta = r2(r.receitaBruta)
  }

  return {
    ano, precosComIva,
    alojamentos: lista.filter(r => r.reservas > 0 || r.despesas > 0),
    reservas: reservas.sort((a, b) => a.check_in.localeCompare(b.check_in)),
    despesas: despesas.sort((a, b) => a.data.localeCompare(b.data)),
    despesasNaoAtribuidas: r2(naoAtribuidas),
  }
}

/** Alojamentos prontos para `mapaFiscal`; os sem modalidade ficam de fora e listados. */
export function paraMapaFiscal(resumo: ResumoAnual): {
  alojamentos: AlojamentoFiscal[]
  semModalidade: string[]
} {
  const semModalidade: string[] = []
  const alojamentos: AlojamentoFiscal[] = []
  for (const r of resumo.alojamentos) {
    if (!r.modalidade) { semModalidade.push(r.nome); continue }
    alojamentos.push({
      id: r.id, nome: r.nome, modalidade: r.modalidade, areaContencao: r.areaContencao,
      vpt: r.vpt, receita: r.receita, despesas: r.despesas,
    })
  }
  return { alojamentos, semModalidade }
}

const CATEGORIAS: ExpenseCategoria[] = ['limpeza', 'manutencao', 'comissoes', 'utilidades', 'marketing', 'iva', 'outro']

/** CSV (separador `;`, decimais com vírgula — é o que o Excel português abre sem assistente). */
export function csvPacoteContabilista(resumo: ResumoAnual): string {
  const esc = (v: unknown) => {
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const linha = (...cols: unknown[]) => cols.map(esc).join(';')
  const out: string[] = []

  out.push(linha(`Pacote para o contabilista — ${resumo.ano}`))
  out.push(linha('Gerado pelo Anfitrião. Critérios:'))
  out.push(linha('- Receita: preço das reservas ativas com check-in no ano; a taxa municipal turística não está incluída (é entregue ao município).'))
  out.push(linha(resumo.precosComIva
    ? '- Preços com IVA incluído: a coluna "Receita sem IVA" tira o IVA à taxa da região do concelho.'
    : '- Preços indicados como sem IVA (regime de isenção): receita sem IVA = receita.'))
  out.push(linha('- Comissões: registadas como despesa; se não houver, estimadas pelas taxas das plataformas (assinalado).'))
  out.push(linha('- Despesas sem alojamento: repartidas pela receita de cada alojamento. Despesas da categoria IVA excluídas.'))
  out.push('')

  out.push(linha('RESUMO POR ESTABELECIMENTO'))
  out.push(linha('Alojamento', 'Concelho', 'Modalidade AL', 'Área de contenção', 'VPT', 'Reservas', 'Noites',
    'Receita (com IVA se aplicável)', 'Taxa IVA %', 'Receita sem IVA', 'Comissões', 'Comissões estimadas?',
    ...CATEGORIAS.filter(c => c !== 'comissoes').map(c => `Despesas ${c}`), 'Despesas repartidas', 'Total dedutível'))
  for (const r of resumo.alojamentos) {
    out.push(linha(r.nome, r.cidade, r.modalidade ?? 'por definir', r.areaContencao ? 'sim' : 'não',
      r.vpt ?? '', String(r.reservas), String(r.noites), r.receitaBruta, String(r.taxaIva), r.receita,
      r.comissoes, r.comissoesEstimadas ? 'sim' : 'não',
      ...CATEGORIAS.filter(c => c !== 'comissoes').map(c => r.despesasPorCategoria[c] ?? 0),
      r.despesasRepartidas, r.despesas))
  }
  out.push('')

  out.push(linha('RESERVAS'))
  out.push(linha('Alojamento', 'Unidade', 'Check-in', 'Check-out', 'Noites', 'Origem', 'Valor', 'Comissão estimada'))
  for (const b of resumo.reservas) {
    out.push(linha(b.alojamento, b.unidade, b.check_in, b.check_out, String(b.noites), b.origem, b.preco_total, b.comissao_estimada))
  }
  out.push('')

  out.push(linha('DESPESAS'))
  out.push(linha('Data', 'Alojamento', 'Categoria', 'Descrição', 'Valor'))
  for (const e of resumo.despesas) out.push(linha(e.data, e.alojamento, e.categoria, e.descricao, e.valor))

  // BOM para o Excel reconhecer UTF-8 (acentos)
  return '﻿' + out.join('\r\n')
}
