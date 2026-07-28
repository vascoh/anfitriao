import { describe, it, expect } from 'vitest'
import { resumoMensal, mesAnterior, variacaoPct, nomeMes } from './relatorio-mensal'
import type { Booking, Property, BookingSource, BookingStatus } from './types'

let seq = 0
function reserva(check_in: string, check_out: string, preco: number, extra?: Partial<Booking>): Booking {
  return {
    id: `b${++seq}`,
    propriedade_id: 'p1',
    hospede_id: null,
    check_in,
    check_out,
    num_hospedes: 2,
    estado: 'confirmada' as BookingStatus,
    origem: 'airbnb' as BookingSource,
    preco_total: preco,
    preco_pago: preco,
    criado_em: check_in,
    historico: [],
    ...extra,
  }
}

function propriedade(id: string, extra?: Partial<Property>): Property {
  return {
    id,
    nome: `Casa ${id}`,
    tipo: 'apartamento',
    endereco: 'Rua A',
    cidade: 'Lisboa',
    capacidade: 4,
    quartos: 2,
    casasBanho: 1,
    comodidades: [],
    instrucoes_checkin: '',
    regras_casa: '',
    preco_base: 100,
    cor: '#000',
    ativo: true,
    criado_em: '2026-01-01',
    ...extra,
  }
}

// Julho de 2026 tem 31 dias
const JULHO = 6
const ANO = 2026

describe('resumoMensal', () => {
  it('devolve zeros sem reservas', () => {
    const r = resumoMensal([], [propriedade('p1')], ANO, JULHO)
    expect(r.receita).toBe(0)
    expect(r.reservas).toBe(0)
    expect(r.ocupacaoPct).toBe(0)
    expect(r.adr).toBe(0)
    expect(r.revpar).toBe(0)
  })

  it('soma a receita das reservas do mês', () => {
    const r = resumoMensal(
      [reserva('2026-07-05', '2026-07-10', 500), reserva('2026-07-20', '2026-07-22', 200)],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.receita).toBe(700)
    expect(r.reservas).toBe(2)
  })

  it('ignora reservas canceladas e no_show', () => {
    const r = resumoMensal(
      [
        reserva('2026-07-05', '2026-07-10', 500),
        reserva('2026-07-12', '2026-07-15', 999, { estado: 'cancelada' }),
        reserva('2026-07-18', '2026-07-20', 888, { estado: 'no_show' }),
      ],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.receita).toBe(500)
    expect(r.reservas).toBe(1)
  })

  it('ignora reservas de outro mês', () => {
    const r = resumoMensal(
      [reserva('2026-06-28', '2026-06-30', 300), reserva('2026-08-01', '2026-08-05', 400)],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.receita).toBe(0)
  })

  it('calcula ocupação com um alojamento', () => {
    // 10 noites ocupadas em 31 dias
    const r = resumoMensal(
      [reserva('2026-07-01', '2026-07-11', 1000)],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.noites).toBe(10)
    expect(r.noitesDisponiveis).toBe(31)
    expect(r.ocupacaoPct).toBe(32)
  })

  it('soma noites disponíveis de vários alojamentos', () => {
    const r = resumoMensal([], [propriedade('p1'), propriedade('p2')], ANO, JULHO)
    expect(r.noitesDisponiveis).toBe(62)
  })

  it('exclui alojamentos inativos do denominador', () => {
    const r = resumoMensal(
      [],
      [propriedade('p1'), propriedade('p2', { ativo: false })],
      ANO, JULHO,
    )
    expect(r.noitesDisponiveis).toBe(31)
  })

  it('calcula ADR e RevPAR', () => {
    const r = resumoMensal(
      [reserva('2026-07-01', '2026-07-11', 1000)], // 10 noites, 1000 €
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.adr).toBe(100)          // 1000 / 10 noites
    expect(r.revpar).toBe(32)        // 1000 / 31 noites disponíveis
  })

  it('agrupa receita por origem, da maior para a menor', () => {
    const r = resumoMensal(
      [
        reserva('2026-07-01', '2026-07-03', 100, { origem: 'airbnb' }),
        reserva('2026-07-05', '2026-07-08', 500, { origem: 'booking' }),
        reserva('2026-07-10', '2026-07-12', 300, { origem: 'direto' }),
      ],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.porOrigem).toEqual([
      { origem: 'booking', valor: 500 },
      { origem: 'direto', valor: 300 },
      { origem: 'airbnb', valor: 100 },
    ])
  })

  it('omite origens sem receita (ex. reservas iCal a zero)', () => {
    const r = resumoMensal(
      [
        reserva('2026-07-01', '2026-07-03', 0, { origem: 'airbnb' }),
        reserva('2026-07-05', '2026-07-08', 200, { origem: 'direto' }),
      ],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.porOrigem).toEqual([{ origem: 'direto', valor: 200 }])
  })

  it('atribui a receita ao mês do check-in em estadias que atravessam meses', () => {
    const r = resumoMensal(
      [reserva('2026-07-30', '2026-08-04', 500)],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(r.receita).toBe(500)
    // Mas as noites contam só as que caem em julho (30 e 31)
    expect(r.noites).toBe(2)
  })

  it('lida com dezembro sem estourar para o ano seguinte', () => {
    const r = resumoMensal(
      [reserva('2026-12-30', '2027-01-02', 400)],
      [propriedade('p1')],
      ANO, 11,
    )
    expect(r.receita).toBe(400)
    expect(r.noitesDisponiveis).toBe(31)
  })

  it('lida com fevereiro bissexto', () => {
    const r = resumoMensal([], [propriedade('p1')], 2028, 1)
    expect(r.noitesDisponiveis).toBe(29)
  })
})

describe('mesAnterior', () => {
  it('recua um mês dentro do mesmo ano', () => {
    expect(mesAnterior('2026-07-01')).toEqual({ ano: 2026, mes: 5 }) // junho
  })

  it('recua de janeiro para dezembro do ano anterior', () => {
    expect(mesAnterior('2026-01-01')).toEqual({ ano: 2025, mes: 11 })
  })

  it('não depende do dia do mês', () => {
    expect(mesAnterior('2026-07-28')).toEqual(mesAnterior('2026-07-01'))
  })
})

describe('variacaoPct', () => {
  it('calcula subidas e descidas', () => {
    expect(variacaoPct(120, 100)).toBe(20)
    expect(variacaoPct(80, 100)).toBe(-20)
  })

  it('devolve null sem base de comparação', () => {
    expect(variacaoPct(100, 0)).toBeNull()
  })

  it('devolve 0 quando não há variação', () => {
    expect(variacaoPct(100, 100)).toBe(0)
  })
})

describe('nomeMes', () => {
  it('devolve os nomes em português', () => {
    expect(nomeMes(0)).toBe('janeiro')
    expect(nomeMes(6)).toBe('julho')
    expect(nomeMes(11)).toBe('dezembro')
  })
})
