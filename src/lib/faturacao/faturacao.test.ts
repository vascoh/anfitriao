import { describe, it, expect } from 'vitest'
import {
  regiaoDoConcelho, taxaIvaAlojamento, semIva, valorIva,
  IVA_ALOJAMENTO, ISENCAO_TAXA_TURISTICA,
} from './iva'
import {
  decomporReserva, linhasDaReserva, totalComIva, pedidoDaReserva, clienteDaReserva,
} from './mapping'
import type { Booking, Guest, Property, BookingStatus } from '../types'

function propriedade(cidade: string): Property {
  return {
    id: 'p1', nome: 'Casa do Vale', tipo: 'apartamento', endereco: 'Rua A', cidade,
    capacidade: 4, quartos: 2, casasBanho: 1, comodidades: [],
    instrucoes_checkin: '', regras_casa: '', preco_base: 100, cor: '#000',
    ativo: true, criado_em: '2026-01-01',
  }
}

function reserva(): Booking {
  return {
    id: 'b1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: '2026-08-01', check_out: '2026-08-04',
    num_hospedes: 2, estado: 'checkout' as BookingStatus, origem: 'direto',
    preco_total: 400, preco_pago: 400, criado_em: '2026-07-01', historico: [],
  }
}

const hospede: Guest = {
  id: 'g1', nome: 'Maria Silva', email: 'maria@exemplo.pt',
  numero_documento: '123456789', tags: [], criado_em: '2026-01-01',
}

describe('regiaoDoConcelho', () => {
  it('assume continente por omissão', () => {
    expect(regiaoDoConcelho('Lisboa')).toBe('continente')
    expect(regiaoDoConcelho(null)).toBe('continente')
    expect(regiaoDoConcelho('')).toBe('continente')
  })

  it('reconhece concelhos da Madeira', () => {
    expect(regiaoDoConcelho('Funchal')).toBe('madeira')
    expect(regiaoDoConcelho('câmara de lobos')).toBe('madeira')
    expect(regiaoDoConcelho('  Porto Santo  ')).toBe('madeira')
  })

  it('reconhece concelhos dos Açores', () => {
    expect(regiaoDoConcelho('Ponta Delgada')).toBe('acores')
    expect(regiaoDoConcelho('Angra do Heroísmo')).toBe('acores')
  })

  it('resolve nomes ambíguos para continente', () => {
    // "Lagoa" existe no Algarve e em São Miguel; "Calheta" na Madeira e em
    // São Jorge. Erra para a taxa mais alta, a favor do Estado.
    expect(regiaoDoConcelho('Lagoa')).toBe('continente')
    expect(regiaoDoConcelho('Calheta')).toBe('madeira') // só existe assim na lista da Madeira
    expect(regiaoDoConcelho('Santa Cruz')).toBe('madeira')
  })
})

describe('taxaIvaAlojamento', () => {
  it('aplica 6% no continente, 5% na Madeira e 4% nos Açores', () => {
    expect(taxaIvaAlojamento('Lisboa')).toBe(6)
    expect(taxaIvaAlojamento('Funchal')).toBe(5)
    expect(taxaIvaAlojamento('Ponta Delgada')).toBe(4)
  })

  it('mantém a tabela coerente', () => {
    expect(IVA_ALOJAMENTO.continente).toBeGreaterThan(IVA_ALOJAMENTO.madeira)
    expect(IVA_ALOJAMENTO.madeira).toBeGreaterThan(IVA_ALOJAMENTO.acores)
  })
})

describe('semIva / valorIva', () => {
  it('retira o IVA de um valor com IVA incluído', () => {
    // 106 € com 6% de IVA → 100 € de base
    expect(semIva(106, 6)).toBe(100)
    expect(valorIva(106, 6)).toBe(6)
  })

  it('devolve o próprio valor quando a taxa é zero', () => {
    expect(semIva(50, 0)).toBe(50)
    expect(valorIva(50, 0)).toBe(0)
  })

  it('arredonda a dois decimais', () => {
    expect(semIva(100, 6)).toBe(94.34)
  })

  it('recompõe o total sem perder cêntimos relevantes', () => {
    const base = semIva(400, 6)
    expect(Math.round((base * 1.06) * 100) / 100).toBeCloseTo(400, 1)
  })
})

describe('decomporReserva', () => {
  it('devolve tudo como alojamento sem extras', () => {
    expect(decomporReserva(400)).toEqual({ alojamento: 400 })
  })

  it('subtrai limpeza e taxa turística', () => {
    expect(decomporReserva(400, { limpeza: 40, taxaTuristica: 24 })).toEqual({
      alojamento: 336, limpeza: 40, taxaTuristica: 24,
    })
  })

  it('omite extras a zero', () => {
    expect(decomporReserva(400, { limpeza: 0, taxaTuristica: 0 })).toEqual({ alojamento: 400 })
  })

  it('nunca devolve alojamento negativo', () => {
    const r = decomporReserva(50, { limpeza: 40, taxaTuristica: 30 })
    expect(r.alojamento).toBe(0)
  })
})

describe('linhasDaReserva', () => {
  it('cria uma linha de alojamento com a taxa do continente', () => {
    const linhas = linhasDaReserva({ alojamento: 424 }, 'Lisboa', '3 noites')
    expect(linhas).toHaveLength(1)
    expect(linhas[0].taxaIva).toBe(6)
    expect(linhas[0].precoUnitario).toBe(400)
  })

  it('usa a taxa da Madeira quando o concelho é de lá', () => {
    const linhas = linhasDaReserva({ alojamento: 105 }, 'Funchal', '1 noite')
    expect(linhas[0].taxaIva).toBe(5)
    expect(linhas[0].precoUnitario).toBe(100)
  })

  it('cria linha de limpeza com a mesma taxa do alojamento', () => {
    const linhas = linhasDaReserva({ alojamento: 424, limpeza: 53 }, 'Lisboa', '3 noites')
    expect(linhas).toHaveLength(2)
    expect(linhas[1].nome).toBe('Taxa de limpeza')
    expect(linhas[1].taxaIva).toBe(6)
    expect(linhas[1].precoUnitario).toBe(50)
  })

  it('cria a taxa turística como linha isenta com código M99', () => {
    const linhas = linhasDaReserva({ alojamento: 424, taxaTuristica: 24 }, 'Lisboa', '3 noites')
    const tmt = linhas.find(l => l.nome === 'Taxa municipal turística')!
    expect(tmt.taxaIva).toBe(0)
    expect(tmt.motivoIsencao).toBe(ISENCAO_TAXA_TURISTICA)
    // Não sujeita a IVA: o valor entra tal como é cobrado, sem conversão
    expect(tmt.precoUnitario).toBe(24)
  })

  it('não cria linhas para componentes a zero', () => {
    expect(linhasDaReserva({ alojamento: 0 }, 'Lisboa', 'x')).toEqual([])
  })

  it('ordena alojamento, limpeza e taxa turística', () => {
    const linhas = linhasDaReserva(
      { alojamento: 424, limpeza: 53, taxaTuristica: 24 }, 'Lisboa', '3 noites',
    )
    expect(linhas.map(l => l.nome)).toEqual([
      'Alojamento', 'Taxa de limpeza', 'Taxa municipal turística',
    ])
  })
})

describe('totalComIva', () => {
  it('reconstrói o valor original cobrado ao hóspede', () => {
    const componentes = { alojamento: 424, limpeza: 53, taxaTuristica: 24 }
    const linhas = linhasDaReserva(componentes, 'Lisboa', '3 noites')
    expect(totalComIva(linhas)).toBeCloseTo(424 + 53 + 24, 1)
  })

  it('não inflaciona o total com a taxa turística', () => {
    const semTmt = totalComIva(linhasDaReserva({ alojamento: 424 }, 'Lisboa', 'x'))
    const comTmt = totalComIva(linhasDaReserva({ alojamento: 424, taxaTuristica: 24 }, 'Lisboa', 'x'))
    expect(comTmt - semTmt).toBeCloseTo(24, 2)
  })

  it('devolve zero sem linhas', () => {
    expect(totalComIva([])).toBe(0)
  })
})

describe('clienteDaReserva', () => {
  it('usa os dados do hóspede', () => {
    const c = clienteDaReserva(hospede, 'Consumidor final')
    expect(c.nome).toBe('Maria Silva')
    expect(c.nif).toBe('123456789')
    expect(c.email).toBe('maria@exemplo.pt')
  })

  it('cai para consumidor final sem hóspede', () => {
    expect(clienteDaReserva(null, 'Consumidor final').nome).toBe('Consumidor final')
  })

  it('cai para consumidor final quando o nome é só espaços', () => {
    const vazio = { ...hospede, nome: '   ' }
    expect(clienteDaReserva(vazio, 'Consumidor final').nome).toBe('Consumidor final')
  })
})

describe('pedidoDaReserva', () => {
  it('monta uma fatura-recibo com data de checkout e referência da reserva', () => {
    const p = pedidoDaReserva(reserva(), propriedade('Lisboa'), hospede, { alojamento: 424 })
    expect(p.tipo).toBe('invoice_receipt')
    expect(p.data).toBe('2026-08-04')
    expect(p.referencia).toBe('b1')
  })

  it('marca para envio por email quando o hóspede tem email', () => {
    expect(pedidoDaReserva(reserva(), propriedade('Lisboa'), hospede, { alojamento: 424 }).enviarPorEmail).toBe(true)
  })

  it('não marca para envio sem email do hóspede', () => {
    const semEmail = { ...hospede, email: undefined }
    expect(pedidoDaReserva(reserva(), propriedade('Lisboa'), semEmail, { alojamento: 424 }).enviarPorEmail).toBe(false)
  })

  it('inclui a descrição da estadia na linha de alojamento', () => {
    const p = pedidoDaReserva(reserva(), propriedade('Lisboa'), hospede, { alojamento: 424 })
    expect(p.linhas[0].descricao).toContain('Casa do Vale')
    expect(p.linhas[0].descricao).toContain('3 noites')
  })
})
