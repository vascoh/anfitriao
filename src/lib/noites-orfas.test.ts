import { describe, it, expect } from 'vitest'
import {
  detetarNoitesOrfas,
  detetarTodasNoitesOrfas,
  descontoSugerido,
  MAX_NOITES_ORFAS,
} from './noites-orfas'
import type { Booking, BookingStatus } from './types'

const HOJE = '2026-07-28'
const PROP = 'prop-1'

let seq = 0
function reserva(check_in: string, check_out: string, extra?: Partial<Booking>): Booking {
  return {
    id: `b${++seq}`,
    propriedade_id: PROP,
    hospede_id: null,
    check_in,
    check_out,
    num_hospedes: 2,
    estado: 'confirmada' as BookingStatus,
    origem: 'airbnb',
    preco_total: 300,
    preco_pago: 0,
    criado_em: HOJE,
    historico: [],
    ...extra,
  }
}

describe('detetarNoitesOrfas', () => {
  it('deteta uma noite isolada entre duas reservas', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-05'), reserva('2026-08-06', '2026-08-10')],
      PROP,
      HOJE,
    )
    expect(orfas).toHaveLength(1)
    expect(orfas[0]).toMatchObject({ inicio: '2026-08-05', fim: '2026-08-06', noites: 1 })
  })

  it('deteta duas noites', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-05'), reserva('2026-08-07', '2026-08-10')],
      PROP,
      HOJE,
    )
    expect(orfas[0].noites).toBe(2)
  })

  it('ignora buracos maiores que o máximo', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-05'), reserva('2026-08-09', '2026-08-12')],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora reservas encostadas (checkout = checkin)', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-05'), reserva('2026-08-05', '2026-08-08')],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora reservas sobrepostas sem rebentar', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-10'), reserva('2026-08-05', '2026-08-08')],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora reservas canceladas ao calcular o buraco', () => {
    // A cancelada preenchia o buraco; sem ela o espaço é grande demais
    const orfas = detetarNoitesOrfas(
      [
        reserva('2026-08-01', '2026-08-05'),
        reserva('2026-08-05', '2026-08-09', { estado: 'cancelada' }),
        reserva('2026-08-09', '2026-08-12'),
      ],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora no_show tal como cancelada', () => {
    const orfas = detetarNoitesOrfas(
      [
        reserva('2026-08-01', '2026-08-05'),
        reserva('2026-08-06', '2026-08-07', { estado: 'no_show' }),
        reserva('2026-08-07', '2026-08-10'),
      ],
      PROP,
      HOJE,
    )
    // O buraco real passa a ser 05→07 = 2 noites
    expect(orfas).toHaveLength(1)
    expect(orfas[0].noites).toBe(2)
  })

  it('ignora buracos para lá do horizonte', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-12-01', '2026-12-05'), reserva('2026-12-06', '2026-12-10')],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora buracos demasiado próximos para reagir', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-07-25', '2026-07-28'), reserva('2026-07-29', '2026-08-02')],
      PROP,
      HOJE,
    )
    // Buraco começa hoje mesmo — antecedência 0, abaixo do mínimo
    expect(orfas).toEqual([])
  })

  it('ignora reservas de outra propriedade', () => {
    const orfas = detetarNoitesOrfas(
      [
        reserva('2026-08-01', '2026-08-05', { propriedade_id: 'outra' }),
        reserva('2026-08-06', '2026-08-10', { propriedade_id: 'outra' }),
      ],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('ignora reservas já terminadas', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-07-01', '2026-07-05'), reserva('2026-07-06', '2026-07-10')],
      PROP,
      HOJE,
    )
    expect(orfas).toEqual([])
  })

  it('não depende da ordem de entrada', () => {
    const a = reserva('2026-08-06', '2026-08-10')
    const b = reserva('2026-08-01', '2026-08-05')
    expect(detetarNoitesOrfas([a, b], PROP, HOJE)).toHaveLength(1)
  })

  it('deteta vários buracos na mesma propriedade', () => {
    const orfas = detetarNoitesOrfas(
      [
        reserva('2026-08-01', '2026-08-05'),
        reserva('2026-08-06', '2026-08-10'),
        reserva('2026-08-11', '2026-08-14'),
      ],
      PROP,
      HOJE,
    )
    expect(orfas.map(o => o.inicio)).toEqual(['2026-08-05', '2026-08-10'])
  })

  it('não trata disponibilidade no fim do calendário como órfã', () => {
    const orfas = detetarNoitesOrfas([reserva('2026-08-01', '2026-08-05')], PROP, HOJE)
    expect(orfas).toEqual([])
  })

  it('respeita opções personalizadas', () => {
    const bookings = [reserva('2026-08-01', '2026-08-05'), reserva('2026-08-09', '2026-08-12')]
    expect(detetarNoitesOrfas(bookings, PROP, HOJE, { maxNoites: 4 })).toHaveLength(1)
  })

  it('lida com lista vazia', () => {
    expect(detetarNoitesOrfas([], PROP, HOJE)).toEqual([])
  })

  it('atravessa a fronteira do ano', () => {
    const orfas = detetarNoitesOrfas(
      [reserva('2026-12-28', '2026-12-31'), reserva('2027-01-01', '2027-01-05')],
      PROP,
      '2026-12-20',
    )
    expect(orfas).toHaveLength(1)
    expect(orfas[0]).toMatchObject({ inicio: '2026-12-31', fim: '2027-01-01', noites: 1 })
  })

  it('respeita o máximo exportado', () => {
    const fim = `2026-08-${String(5 + MAX_NOITES_ORFAS).padStart(2, '0')}`
    const orfas = detetarNoitesOrfas(
      [reserva('2026-08-01', '2026-08-05'), reserva(fim, '2026-08-20')],
      PROP,
      HOJE,
    )
    expect(orfas[0].noites).toBe(MAX_NOITES_ORFAS)
  })
})

describe('detetarTodasNoitesOrfas', () => {
  it('junta buracos de várias propriedades', () => {
    const bookings = [
      reserva('2026-08-01', '2026-08-05'),
      reserva('2026-08-06', '2026-08-10'),
      reserva('2026-08-01', '2026-08-05', { propriedade_id: 'prop-2' }),
      reserva('2026-08-06', '2026-08-10', { propriedade_id: 'prop-2' }),
    ]
    const orfas = detetarTodasNoitesOrfas(bookings, [PROP, 'prop-2'], HOJE)
    expect(orfas).toHaveLength(2)
    expect(new Set(orfas.map(o => o.propriedade_id))).toEqual(new Set([PROP, 'prop-2']))
  })

  it('devolve vazio sem propriedades', () => {
    expect(detetarTodasNoitesOrfas([], [], HOJE)).toEqual([])
  })
})

describe('descontoSugerido', () => {
  const base = { propriedade_id: PROP, inicio: '2026-08-10', fim: '2026-08-11' }

  it('é mais agressivo para uma noite do que para duas', () => {
    const uma = descontoSugerido({ ...base, noites: 1, antecedencia: 30 })
    const duas = descontoSugerido({ ...base, noites: 2, antecedencia: 30 })
    expect(uma).toBeGreaterThan(duas)
  })

  it('sobe quando a data está próxima', () => {
    const longe = descontoSugerido({ ...base, noites: 1, antecedencia: 45 })
    const perto = descontoSugerido({ ...base, noites: 1, antecedencia: 5 })
    expect(perto).toBeGreaterThan(longe)
  })

  it('nunca ultrapassa 30%', () => {
    expect(descontoSugerido({ ...base, noites: 1, antecedencia: 2 })).toBeLessThanOrEqual(30)
  })

  it('nunca sugere desconto nulo ou negativo', () => {
    for (const antecedencia of [2, 10, 30, 60]) {
      for (const noites of [1, 2]) {
        expect(descontoSugerido({ ...base, noites, antecedencia })).toBeGreaterThan(0)
      }
    }
  })
})
