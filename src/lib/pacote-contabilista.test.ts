import { describe, it, expect } from 'vitest'
import { resumoFiscalAnual, paraMapaFiscal, csvPacoteContabilista, modalidadeSugerida } from './pacote-contabilista'
import type { Booking, Expense, PlatformRate, Property } from './types'

function prop(over: Partial<Property>): Property {
  return {
    id: 'p', nome: 'P', tipo: 'apartamento', endereco: '', cidade: 'Lisboa', capacidade: 2,
    quartos: 1, casasBanho: 1, comodidades: [], instrucoes_checkin: '', regras_casa: '',
    preco_base: 100, cor: '#000', ativo: true, criado_em: '2026-01-01', ...over,
  } as Property
}

function reserva(over: Partial<Booking>): Booking {
  return {
    id: Math.random().toString(36), propriedade_id: 'apt', hospede_id: 'g1',
    check_in: '2026-03-01', check_out: '2026-03-04', num_hospedes: 2, estado: 'confirmada',
    origem: 'direto', preco_total: 300, preco_pago: 300, criado_em: '2026-01-01', historico: [],
    ...over,
  } as Booking
}

function despesa(over: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36), categoria: 'limpeza', descricao: 'x', valor: 50,
    data: '2026-03-05', criado_em: '2026-03-05', propriedade_id: 'apt', ...over,
  } as Expense
}

const PROPS = [
  prop({ id: 'apt', nome: 'T1 Lisboa', al_modalidade: 'apartamento', vpt: 100_000 }),
  prop({ id: 'casa', nome: 'Casa Amora', tipo: 'moradia', cidade: 'Seixal', al_modalidade: 'hospedagem' }),
  prop({ id: 'q1', nome: 'Quarto 1', parent_id: 'casa' }),
  prop({ id: 'q2', nome: 'Quarto 2', parent_id: 'casa' }),
]
const RATES: PlatformRate[] = [
  { id: 'r', property_id: 'apt', plataforma: 'airbnb', multiplicador: 1, comissao_pct: 15, ativo: true, criado_em: '' },
]

const base = (over: Partial<Parameters<typeof resumoFiscalAnual>[0]> = {}) =>
  resumoFiscalAnual({
    ano: 2026, bookings: [], expenses: [], properties: PROPS, platformRates: RATES,
    precosComIva: false, ...over,
  })

describe('resumoFiscalAnual', () => {
  it('reservas e despesas dos quartos sobem para a casa (o estabelecimento)', () => {
    const r = base({
      bookings: [reserva({ propriedade_id: 'q1' }), reserva({ propriedade_id: 'q2', preco_total: 200 })],
      expenses: [despesa({ propriedade_id: 'q1', valor: 30 })],
    })
    const casa = r.alojamentos.find(a => a.id === 'casa')!
    expect(casa.receita).toBe(500)
    expect(casa.reservas).toBe(2)
    expect(casa.despesas).toBe(30)
    expect(r.alojamentos.some(a => a.id === 'q1')).toBe(false)
  })

  it('só conta reservas ativas do ano e deixa de fora bloqueios', () => {
    const r = base({
      bookings: [
        reserva({}),
        reserva({ estado: 'cancelada' }),
        reserva({ check_in: '2025-12-30' }),
        reserva({ hospede_id: undefined, uid_externo: undefined, preco_total: 999 }), // bloqueio
      ],
    })
    expect(r.alojamentos[0].receita).toBe(300)
    expect(r.alojamentos[0].reservas).toBe(1)
  })

  it('estima comissões só quando não há nenhuma registada — nunca as duas', () => {
    const estimada = base({ bookings: [reserva({ origem: 'airbnb', preco_total: 1000 })] })
    expect(estimada.alojamentos[0].comissoes).toBe(150)
    expect(estimada.alojamentos[0].comissoesEstimadas).toBe(true)
    expect(estimada.alojamentos[0].despesas).toBe(150)

    const registada = base({
      bookings: [reserva({ origem: 'airbnb', preco_total: 1000 })],
      expenses: [despesa({ categoria: 'comissoes', valor: 140 })],
    })
    expect(registada.alojamentos[0].comissoes).toBe(140)
    expect(registada.alojamentos[0].comissoesEstimadas).toBe(false)
    expect(registada.alojamentos[0].despesas).toBe(140)
  })

  it('despesas de IVA ficam de fora e as não atribuídas repartem-se pela receita', () => {
    const r = base({
      bookings: [reserva({ preco_total: 300 }), reserva({ propriedade_id: 'q1', preco_total: 100 })],
      expenses: [
        despesa({ categoria: 'iva', valor: 999 }),
        despesa({ propriedade_id: null, categoria: 'outro', valor: 40 }),
      ],
    })
    const apt = r.alojamentos.find(a => a.id === 'apt')!
    const casa = r.alojamentos.find(a => a.id === 'casa')!
    expect(apt.despesasRepartidas).toBe(30)
    expect(casa.despesasRepartidas).toBe(10)
    expect(apt.despesas).toBe(30) // sem os 999 de IVA
    expect(r.despesasNaoAtribuidas).toBe(40)
  })

  it('com preços com IVA, a receita tira o IVA à taxa da região', () => {
    const r = base({ bookings: [reserva({ preco_total: 106 })], precosComIva: true })
    expect(r.alojamentos[0].taxaIva).toBe(6)
    expect(r.alojamentos[0].receita).toBe(100)
    expect(r.alojamentos[0].receitaBruta).toBe(106)
  })
})

describe('paraMapaFiscal', () => {
  it('deixa de fora quem não tem modalidade, e di-lo', () => {
    const props = [prop({ id: 'apt', nome: 'Sem registo' })]
    const r = resumoFiscalAnual({
      ano: 2026, bookings: [reserva({})], expenses: [], properties: props, platformRates: [], precosComIva: false,
    })
    const { alojamentos, semModalidade } = paraMapaFiscal(r)
    expect(alojamentos).toHaveLength(0)
    expect(semModalidade).toEqual(['Sem registo'])
  })
})

describe('csvPacoteContabilista', () => {
  it('usa ; e vírgula decimal, com BOM, e explica os critérios', () => {
    const csv = csvPacoteContabilista(base({ bookings: [reserva({ preco_total: 1234.5 })] }))
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('1234,50')
    expect(csv).toContain('taxa municipal turística não está incluída')
    expect(csv.split('\r\n').find(l => l.startsWith('T1 Lisboa;'))).toContain(';apartamento;')
  })
})

it('modalidadeSugerida é só um ponto de partida', () => {
  expect(modalidadeSugerida({ tipo: 'moradia' })).toBe('moradia')
  expect(modalidadeSugerida({ tipo: 'outro' })).toBeNull()
})
