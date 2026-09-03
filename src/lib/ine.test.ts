import { describe, it, expect } from 'vitest'
import { gerarMapaIne, noitesNoMes, prazoIne, PAIS_DESCONHECIDO } from './ine'
import type { Booking, Guest, Property, BookingStatus } from './types'

const ANO = 2026
const JULHO = 6

let seq = 0
function reserva(
  check_in: string,
  check_out: string,
  num_hospedes: number,
  hospede_id: string | null,
  extra?: Partial<Booking>,
): Booking {
  return {
    id: `b${++seq}`,
    propriedade_id: 'p1',
    hospede_id,
    check_in,
    check_out,
    num_hospedes,
    estado: 'confirmada' as BookingStatus,
    origem: 'airbnb',
    preco_total: 100,
    preco_pago: 100,
    criado_em: check_in,
    historico: [],
    ...extra,
  }
}

function hospede(id: string, nacionalidade?: string, pais_residencia?: string): Guest {
  return { id, nome: `H ${id}`, nacionalidade, pais_residencia, tags: [], criado_em: '2026-01-01' }
}

function propriedade(id: string): Property {
  return {
    id, nome: `Casa ${id}`, tipo: 'apartamento', endereco: '', cidade: 'Lisboa',
    capacidade: 4, quartos: 2, casasBanho: 1, comodidades: [],
    instrucoes_checkin: '', regras_casa: '', preco_base: 100, cor: '#000',
    ativo: true, criado_em: '2026-01-01',
  }
}

const PROPS = [propriedade('p1')]

describe('noitesNoMes', () => {
  it('conta todas as noites de uma estadia dentro do mês', () => {
    expect(noitesNoMes(reserva('2026-07-05', '2026-07-10', 1, null), ANO, JULHO)).toBe(5)
  })

  it('reparte estadias que atravessam o fim do mês', () => {
    const b = reserva('2026-07-30', '2026-08-03', 1, null)
    expect(noitesNoMes(b, ANO, JULHO)).toBe(2)   // 30 e 31
    expect(noitesNoMes(b, ANO, 7)).toBe(2)       // 1 e 2 de agosto
  })

  it('reparte estadias que começam no mês anterior', () => {
    const b = reserva('2026-06-28', '2026-07-03', 1, null)
    expect(noitesNoMes(b, ANO, JULHO)).toBe(2)   // 1 e 2 de julho
  })

  it('devolve zero para estadias fora do mês', () => {
    expect(noitesNoMes(reserva('2026-05-01', '2026-05-05', 1, null), ANO, JULHO)).toBe(0)
  })

  it('atravessa a fronteira do ano', () => {
    // 30/dez → 3/jan são 4 noites: 30 e 31 de dezembro, 1 e 2 de janeiro
    const b = reserva('2026-12-30', '2027-01-03', 1, null)
    expect(noitesNoMes(b, ANO, 11)).toBe(2)
    expect(noitesNoMes(b, 2027, 0)).toBe(2)
  })
})

describe('gerarMapaIne', () => {
  it('marca sem movimento quando não há reservas', () => {
    const m = gerarMapaIne([], [], PROPS, ANO, JULHO)
    expect(m.semMovimento).toBe(true)
    expect(m.linhas).toEqual([])
    expect(m.totalHospedes).toBe(0)
  })

  it('conta hóspedes e dormidas por país', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-04', 2, 'g1')],
      [hospede('g1', 'Portugal')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas).toEqual([{ pais: 'Portugal', hospedes: 2, dormidas: 6 }])
    expect(m.totalDormidas).toBe(6) // 2 pessoas × 3 noites
  })

  it('agrupa vários hóspedes do mesmo país', () => {
    const m = gerarMapaIne(
      [
        reserva('2026-07-01', '2026-07-03', 2, 'g1'),
        reserva('2026-07-10', '2026-07-12', 1, 'g2'),
      ],
      [hospede('g1', 'França'), hospede('g2', 'França')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas).toEqual([{ pais: 'França', hospedes: 3, dormidas: 6 }])
  })

  it('ordena por dormidas, da maior para a menor', () => {
    const m = gerarMapaIne(
      [
        reserva('2026-07-01', '2026-07-02', 1, 'g1'),  // 1 dormida
        reserva('2026-07-05', '2026-07-10', 2, 'g2'),  // 10 dormidas
      ],
      [hospede('g1', 'Espanha'), hospede('g2', 'Alemanha')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas.map(l => l.pais)).toEqual(['Alemanha', 'Espanha'])
  })

  it('declara o país de residência, não a nacionalidade', () => {
    /* O INE pede residência: um português a viver em Londres conta como
     * residente no Reino Unido. O mapa usava a nacionalidade "porque era o
     * único campo recolhido" — deixou de ser verdade quando o check-in passou
     * a exigir `pais_residencia` para o boletim do SIBA. */
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-04', 2, 'g1')],
      [hospede('g1', 'Portugal', 'Reino Unido')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas.map(l => l.pais)).toEqual(['Reino Unido'])
  })

  it('cai na nacionalidade quando a ficha é anterior à residência', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-04', 2, 'g1')],
      [hospede('g1', 'França')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas.map(l => l.pais)).toEqual(['França'])
  })

  it('usa "Não especificado" quando falta a nacionalidade', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-03', 1, 'g1')],
      [hospede('g1')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas[0].pais).toBe(PAIS_DESCONHECIDO)
  })

  it('trata nacionalidade só com espaços como não especificada', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-03', 1, 'g1')],
      [hospede('g1', '   ')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas[0].pais).toBe(PAIS_DESCONHECIDO)
  })

  it('lida com uma reserva cuja ficha de hóspede não está disponível', () => {
    /* Antes, a reserva de teste vinha sem `hospede_id` **e** sem origem
     * externa — que é a definição de bloqueio desde que `eBloqueio` existe, e
     * o calendário já a pintava de cinzento. O INE contava-a como 2 hóspedes:
     * a app dizia duas coisas diferentes sobre a mesma linha.
     *
     * O caso que este teste quer cobrir é outro e continua a valer: há
     * hóspede, mas a ficha dele não veio na consulta. */
    const m = gerarMapaIne([reserva('2026-07-01', '2026-07-03', 2, 'sem-ficha')], [], PROPS, ANO, JULHO)
    expect(m.linhas[0]).toEqual({ pais: PAIS_DESCONHECIDO, hospedes: 2, dormidas: 4 })
  })

  it('ignora canceladas e no_show', () => {
    const m = gerarMapaIne(
      [
        reserva('2026-07-01', '2026-07-03', 2, 'g1', { estado: 'cancelada' }),
        reserva('2026-07-05', '2026-07-07', 2, 'g1', { estado: 'no_show' }),
      ],
      [hospede('g1', 'Portugal')],
      PROPS, ANO, JULHO,
    )
    expect(m.semMovimento).toBe(true)
  })

  it('conta hóspedes só no mês de entrada mas reparte as dormidas', () => {
    // Entra a 30 de junho, sai a 3 de julho
    const bookings = [reserva('2026-06-30', '2026-07-03', 2, 'g1')]
    const guests = [hospede('g1', 'Itália')]

    const julho = gerarMapaIne(bookings, guests, PROPS, ANO, JULHO)
    expect(julho.totalHospedes).toBe(0)   // entrou em junho
    expect(julho.totalDormidas).toBe(4)   // 2 pessoas × 2 noites de julho

    const junho = gerarMapaIne(bookings, guests, PROPS, ANO, 5)
    expect(junho.totalHospedes).toBe(2)
    expect(junho.totalDormidas).toBe(2)   // 2 pessoas × 1 noite de junho
  })

  it('assume pelo menos uma pessoa quando num_hospedes é zero', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-03', 0, 'g1')],
      [hospede('g1', 'Portugal')],
      PROPS, ANO, JULHO,
    )
    expect(m.linhas[0]).toEqual({ pais: 'Portugal', hospedes: 1, dormidas: 2 })
  })

  it('filtra por propriedade quando pedido', () => {
    const props = [propriedade('p1'), propriedade('p2')]
    const bookings = [
      reserva('2026-07-01', '2026-07-03', 1, 'g1'),
      reserva('2026-07-01', '2026-07-03', 5, 'g2', { propriedade_id: 'p2' }),
    ]
    const guests = [hospede('g1', 'Portugal'), hospede('g2', 'Brasil')]

    const so1 = gerarMapaIne(bookings, guests, props, ANO, JULHO, { propriedadeId: 'p1' })
    expect(so1.totalHospedes).toBe(1)

    const todas = gerarMapaIne(bookings, guests, props, ANO, JULHO)
    expect(todas.totalHospedes).toBe(6)
  })

  it('ignora reservas de propriedades desconhecidas', () => {
    const m = gerarMapaIne(
      [reserva('2026-07-01', '2026-07-03', 2, 'g1', { propriedade_id: 'fantasma' })],
      [hospede('g1', 'Portugal')],
      PROPS, ANO, JULHO,
    )
    expect(m.semMovimento).toBe(true)
  })

  it('calcula a estadia média', () => {
    const m = gerarMapaIne(
      [
        reserva('2026-07-01', '2026-07-04', 1, 'g1'), // 3 dormidas, 1 hóspede
        reserva('2026-07-10', '2026-07-12', 1, 'g2'), // 2 dormidas, 1 hóspede
      ],
      [hospede('g1', 'Portugal'), hospede('g2', 'Portugal')],
      PROPS, ANO, JULHO,
    )
    expect(m.estadiaMedia).toBe(2.5)
  })

  it('não devolve estadia média infinita sem hóspedes', () => {
    expect(gerarMapaIne([], [], PROPS, ANO, JULHO).estadiaMedia).toBe(0)
  })
})

describe('prazoIne', () => {
  it('é o dia 10 do mês seguinte', () => {
    expect(prazoIne(2026, 6)).toBe('2026-08-10')
  })

  it('passa para o ano seguinte em dezembro', () => {
    expect(prazoIne(2026, 11)).toBe('2027-01-10')
  })
})

describe('gerarMapaIne · bloqueios de um feed de disponibilidade', () => {
  /* O INE pergunta por pessoas alojadas. Um bloqueio do Amenitiz vem com
   * `num_hospedes: 1` e sem hóspede — declará-lo era inventar um hóspede
   * numa resposta oficial. */
  const bloqueio = () => reserva('2026-07-02', '2026-07-09', 1, null, {
    uid_externo: 'f::1',
    notas: 'Quarto indisponível',
  })

  it('não entram como hóspedes nem como dormidas', () => {
    const m = gerarMapaIne([bloqueio()], [], [propriedade('p1')], ANO, JULHO)
    expect(m.totalHospedes).toBe(0)
    expect(m.totalDormidas).toBe(0)
    expect(m.semMovimento).toBe(true)
  })

  it('uma estadia a sério continua a contar ao lado de um bloqueio', () => {
    const m = gerarMapaIne(
      [bloqueio(), reserva('2026-07-10', '2026-07-12', 2, 'h1')],
      [hospede('h1', 'PT', 'PT')],
      [propriedade('p1')],
      ANO, JULHO,
    )
    expect(m.totalHospedes).toBe(2)
    expect(m.totalDormidas).toBe(4)
  })
})
