import { describe, it, expect } from 'vitest'
import {
  quartosDaCasa, temQuartos, capacidadeTotal, disponibilidadeDosQuartos,
  sugerirQuartos, distribuirPessoas, agruparReservas, eGrupo,
} from './grupos'
import type { Booking, Property } from './types'

/** A Casa de Vasco, tal como está em produção: 1 + 2 + 5 = 8 pessoas. */
function quarto(id: string, nome: string, capacidade: number, preco: number): Property {
  return {
    id, nome, tipo: 'quarto', endereco: '', cidade: 'Amora',
    capacidade, quartos: 1, casasBanho: 1, comodidades: [],
    instrucoes_checkin: '', regras_casa: '', preco_base: preco, cor: '#000',
    ativo: true, criado_em: '2026-01-01', parent_id: 'casa',
  }
}

const CASA: Property = {
  id: 'casa', nome: 'Casa de Vasco', tipo: 'moradia', endereco: 'Rua de Bijagós 13A',
  cidade: 'Amora', capacidade: 8, quartos: 3, casasBanho: 2, comodidades: [],
  instrucoes_checkin: '', regras_casa: '', preco_base: 80, cor: '#000',
  ativo: true, criado_em: '2026-01-01', parent_id: null,
}

const INDIVIDUAL = quarto('q-ind', 'Quarto Individual', 1, 50)
const CASAL = quarto('q-cas', 'Quarto de Casal', 2, 80)
const FAMILIAR = quarto('q-fam', 'Quarto Familiar', 5, 100)
const TODAS: Property[] = [CASA, INDIVIDUAL, CASAL, FAMILIAR]

function reserva(id: string, propriedadeId: string, ci: string, co: string, extra?: Partial<Booking>): Booking {
  return {
    id, propriedade_id: propriedadeId, hospede_id: 'g1',
    check_in: ci, check_out: co, num_hospedes: 2,
    estado: 'confirmada', origem: 'direto',
    preco_total: 100, preco_pago: 0, criado_em: '2026-07-01', historico: [],
    ...extra,
  }
}

describe('quartosDaCasa', () => {
  it('devolve só os quartos ativos daquela casa', () => {
    expect(quartosDaCasa(TODAS, 'casa').map(q => q.id)).toEqual(['q-fam', 'q-cas', 'q-ind'])
  })

  it('ordena do maior para o menor', () => {
    expect(quartosDaCasa(TODAS, 'casa').map(q => q.capacidade)).toEqual([5, 2, 1])
  })

  it('ignora quartos desativados', () => {
    const comInativo = [...TODAS, quarto('q-off', 'Arrumos', 2, 10)].map(p =>
      p.id === 'q-off' ? { ...p, ativo: false } : p,
    )
    expect(quartosDaCasa(comInativo, 'casa')).toHaveLength(3)
  })

  it('uma casa sem quartos não tem quartos', () => {
    expect(quartosDaCasa([CASA], 'casa')).toEqual([])
    expect(temQuartos([CASA], 'casa')).toBe(false)
    expect(temQuartos(TODAS, 'casa')).toBe(true)
  })
})

describe('capacidadeTotal', () => {
  it('a Casa de Vasco leva 8 pessoas', () => {
    expect(capacidadeTotal(quartosDaCasa(TODAS, 'casa'))).toBe(8)
  })
})

describe('disponibilidadeDosQuartos', () => {
  const quartos = quartosDaCasa(TODAS, 'casa')

  it('com a casa vazia estão todos livres', () => {
    const d = disponibilidadeDosQuartos(quartos, [], '2026-08-10', '2026-08-14')
    expect(d.every(x => x.livre)).toBe(true)
  })

  it('marca o quarto ocupado e diz qual é a reserva', () => {
    const existente = reserva('b1', 'q-fam', '2026-08-12', '2026-08-16')
    const d = disponibilidadeDosQuartos(quartos, [existente], '2026-08-10', '2026-08-14')
    const familiar = d.find(x => x.quarto.id === 'q-fam')!
    expect(familiar.livre).toBe(false)
    expect(familiar.conflito?.id).toBe('b1')
  })

  it('uma reserva cancelada não ocupa nada', () => {
    const cancelada = reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { estado: 'cancelada' })
    const d = disponibilidadeDosQuartos(quartos, [cancelada], '2026-08-10', '2026-08-14')
    expect(d.every(x => x.livre)).toBe(true)
  })

  it('uma reserva que acaba no dia em que a outra começa não é conflito', () => {
    const anterior = reserva('b1', 'q-fam', '2026-08-06', '2026-08-10')
    const d = disponibilidadeDosQuartos(quartos, [anterior], '2026-08-10', '2026-08-14')
    expect(d.every(x => x.livre)).toBe(true)
  })
})

describe('sugerirQuartos', () => {
  const quartos = quartosDaCasa(TODAS, 'casa')
  const livre = () => disponibilidadeDosQuartos(quartos, [], '2026-08-10', '2026-08-14')

  it('8 pessoas cabem, e ocupam a casa toda sem sobrar lugar', () => {
    // O cenário que motivou isto. Cabe à justa: 5 + 2 + 1.
    const r = sugerirQuartos(livre(), 8)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.quartos.map(q => q.id).sort()).toEqual(['q-cas', 'q-fam', 'q-ind'])
    expect(r.sobra).toBe(0)
  })

  it('9 pessoas já não cabem', () => {
    const r = sugerirQuartos(livre(), 9)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('nao_cabe')
    expect(r.capacidadeDisponivel).toBe(8)
  })

  it('usa o menor número de quartos possível', () => {
    // 5 pessoas: o familiar sozinho chega. Deixar o casal livre pode valer
    // outra reserva no mesmo fim de semana.
    const r = sugerirQuartos(livre(), 5)
    expect(r.ok && r.quartos.map(q => q.id)).toEqual(['q-fam'])
    expect(r.ok && r.sobra).toBe(0)
  })

  it('junta quartos quando um não chega', () => {
    const r = sugerirQuartos(livre(), 7)
    expect(r.ok && r.quartos.map(q => q.id)).toEqual(['q-fam', 'q-cas'])
    expect(r.ok && r.sobra).toBe(0)
  })

  it('diz quanta capacidade sobra, para o anfitrião saber que pode vender mais', () => {
    const r = sugerirQuartos(livre(), 6)
    expect(r.ok && r.quartos.map(q => q.id)).toEqual(['q-fam', 'q-cas'])
    expect(r.ok && r.sobra).toBe(1)
  })

  it('só conta os quartos livres nas datas pedidas', () => {
    const ocupado = reserva('b1', 'q-fam', '2026-08-10', '2026-08-14')
    const d = disponibilidadeDosQuartos(quartos, [ocupado], '2026-08-10', '2026-08-14')
    const r = sugerirQuartos(d, 4)
    expect(r.ok).toBe(false)
    if (r.ok) return
    // Sem o familiar sobram 3 lugares, não 8.
    expect(r.capacidadeDisponivel).toBe(3)
  })

  it('distingue "não há nada livre" de "não cabe"', () => {
    const todosOcupados = quartos.map((q, i) => reserva(`b${i}`, q.id, '2026-08-10', '2026-08-14'))
    const d = disponibilidadeDosQuartos(quartos, todosOcupados, '2026-08-10', '2026-08-14')
    const r = sugerirQuartos(d, 2)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('sem_quartos')
  })
})

describe('distribuirPessoas', () => {
  it('enche os maiores primeiro', () => {
    const m = distribuirPessoas([FAMILIAR, CASAL, INDIVIDUAL], 8)
    expect(m.get('q-fam')).toBe(5)
    expect(m.get('q-cas')).toBe(2)
    expect(m.get('q-ind')).toBe(1)
  })

  it('não põe ninguém nos quartos que não são precisos', () => {
    const m = distribuirPessoas([FAMILIAR, CASAL], 5)
    expect(m.get('q-fam')).toBe(5)
    expect(m.get('q-cas')).toBe(0)
  })

  it('a soma bate sempre certo com o grupo', () => {
    for (const pessoas of [1, 2, 3, 5, 6, 7, 8]) {
      const m = distribuirPessoas([FAMILIAR, CASAL, INDIVIDUAL], pessoas)
      expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(pessoas)
    }
  })

  it('não perde ninguém em silêncio se a capacidade não chegar', () => {
    const m = distribuirPessoas([CASAL], 5)
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(5)
  })
})

describe('agruparReservas', () => {
  it('junta as reservas do mesmo grupo numa só', () => {
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, num_hospedes: 5, preco_total: 400 }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, num_hospedes: 2, preco_total: 320 }),
      reserva('b3', 'q-ind', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, num_hospedes: 1, preco_total: 200 }),
    ]
    const grupos = agruparReservas(rs)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].numHospedes).toBe(8)
    expect(grupos[0].precoTotal).toBe(920)
    expect(eGrupo(grupos[0])).toBe(true)
  })

  it('uma reserva sem grupo é um grupo de uma', () => {
    const grupos = agruparReservas([reserva('b1', 'q-cas', '2026-08-10', '2026-08-14')])
    expect(grupos).toHaveLength(1)
    expect(eGrupo(grupos[0])).toBe(false)
  })

  it('não mistura grupos diferentes', () => {
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: 'g1' }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: 'g2' }),
      reserva('b3', 'q-ind', '2026-08-10', '2026-08-14'),
    ]
    expect(agruparReservas(rs)).toHaveLength(3)
  })

  it('o grupo mostra o estado menos avançado — se um quarto ainda está pendente, o grupo está', () => {
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'confirmada' }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'pendente' }),
    ]
    expect(agruparReservas(rs)[0].estado).toBe('pendente')
  })

  it('um quarto cancelado não cancela o grupo inteiro', () => {
    // Cancelar um dos três quartos mostrava o grupo como "Cancelada" na lista,
    // com o hóspede a chegar na mesma aos outros dois.
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'cancelada' }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'confirmada' }),
      reserva('b3', 'q-ind', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'pendente' }),
    ]
    expect(agruparReservas(rs)[0].estado).toBe('pendente')
  })

  it('o dinheiro do quarto cancelado sai da conta do grupo', () => {
    // O hóspede não deve o quarto que já não vai ocupar — a mesma regra que a
    // faturação já aplicava (`ativas`), e que a lista contradizia.
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'cancelada', preco_total: 300, num_hospedes: 4 }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'confirmada', preco_total: 200, num_hospedes: 2 }),
    ]
    const grupo = agruparReservas(rs)[0]
    expect(grupo.precoTotal).toBe(200)
    expect(grupo.numHospedes).toBe(2)
    expect(grupo.reservas).toHaveLength(2) // continua a mostrar as duas linhas
  })

  it('um grupo todo cancelado mostra-se como cancelado, com os seus valores', () => {
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'cancelada', preco_total: 300 }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, estado: 'cancelada', preco_total: 200 }),
    ]
    const grupo = agruparReservas(rs)[0]
    expect(grupo.estado).toBe('cancelada')
    expect(grupo.precoTotal).toBe(500)
  })

  it('o intervalo do grupo cobre todas as reservas', () => {
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-16', { reserva_grupo_id: g }),
    ]
    const grupo = agruparReservas(rs)[0]
    expect(grupo.checkIn).toBe('2026-08-10')
    expect(grupo.checkOut).toBe('2026-08-16')
  })

  it('soma o que já foi pago', () => {
    const g = 'grupo-1'
    const rs = [
      reserva('b1', 'q-fam', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, preco_pago: 100 }),
      reserva('b2', 'q-cas', '2026-08-10', '2026-08-14', { reserva_grupo_id: g, preco_pago: 50 }),
    ]
    expect(agruparReservas(rs)[0].precoPago).toBe(150)
  })
})
