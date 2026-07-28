import { describe, it, expect } from 'vitest'
import {
  regraPara, dentroDaEstacao, valorDaNoite, calcularTmt, REGRAS_TMT,
  type RegraTmt,
} from './taxa-turistica'
import type { Booking, BookingStatus } from './types'

let seq = 0
function reserva(check_in: string, check_out: string, num_hospedes = 2): Booking {
  return {
    id: `b${++seq}`,
    propriedade_id: 'p1',
    hospede_id: null,
    check_in,
    check_out,
    num_hospedes,
    estado: 'confirmada' as BookingStatus,
    origem: 'airbnb',
    preco_total: 100,
    preco_pago: 100,
    criado_em: check_in,
    historico: [],
  }
}

const LISBOA = regraPara('Lisboa')!
const ALBUFEIRA = regraPara('Albufeira')!
const LOULE = regraPara('Loulé')!

describe('REGRAS_TMT', () => {
  it('tem fonte e data de verificação em todas as regras', () => {
    for (const r of REGRAS_TMT) {
      expect(r.fonte.length).toBeGreaterThan(0)
      expect(r.verificadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('define sempre valor fixo ou estações, nunca ambos nem nenhum', () => {
    for (const r of REGRAS_TMT) {
      const temValor = r.valor !== undefined
      const temEstacoes = r.estacoes !== undefined && r.estacoes.length > 0
      expect(temValor !== temEstacoes).toBe(true)
    }
  })

  it('tem limites de noites e idade plausíveis', () => {
    for (const r of REGRAS_TMT) {
      expect(r.maxNoites).toBeGreaterThan(0)
      expect(r.maxNoites).toBeLessThanOrEqual(14)
      expect(r.isencaoIdade).toBeGreaterThan(0)
      expect(r.isencaoIdade).toBeLessThanOrEqual(18)
    }
  })
})

describe('regraPara', () => {
  it('encontra o concelho ignorando maiúsculas e espaços', () => {
    expect(regraPara('lisboa')?.concelho).toBe('Lisboa')
    expect(regraPara('  Porto  ')?.concelho).toBe('Porto')
  })

  it('devolve null para concelho não configurado', () => {
    // Deliberadamente fora da lista por fontes contraditórias
    expect(regraPara('Faro')).toBeNull()
    expect(regraPara('Lagos')).toBeNull()
    expect(regraPara('Braga')).toBeNull()
  })

  it('devolve null para vazio ou nulo', () => {
    expect(regraPara('')).toBeNull()
    expect(regraPara(null)).toBeNull()
    expect(regraPara(undefined)).toBeNull()
  })
})

describe('dentroDaEstacao', () => {
  const verao = { de: '04-01', ate: '10-31', valor: 2 }
  const inverno = { de: '11-01', ate: '03-31', valor: 1 }

  it('reconhece um intervalo normal', () => {
    expect(dentroDaEstacao('07-15', verao)).toBe(true)
    expect(dentroDaEstacao('04-01', verao)).toBe(true)
    expect(dentroDaEstacao('10-31', verao)).toBe(true)
    expect(dentroDaEstacao('03-31', verao)).toBe(false)
    expect(dentroDaEstacao('11-01', verao)).toBe(false)
  })

  it('reconhece um intervalo que atravessa o ano', () => {
    expect(dentroDaEstacao('12-25', inverno)).toBe(true)
    expect(dentroDaEstacao('01-15', inverno)).toBe(true)
    expect(dentroDaEstacao('11-01', inverno)).toBe(true)
    expect(dentroDaEstacao('03-31', inverno)).toBe(true)
    expect(dentroDaEstacao('07-15', inverno)).toBe(false)
  })
})

describe('valorDaNoite', () => {
  it('devolve o valor fixo quando não há sazonalidade', () => {
    expect(valorDaNoite(LISBOA, '2026-01-15')).toBe(4)
    expect(valorDaNoite(LISBOA, '2026-08-15')).toBe(4)
  })

  it('devolve zero fora da época em Albufeira', () => {
    expect(valorDaNoite(ALBUFEIRA, '2026-08-15')).toBe(2)
    expect(valorDaNoite(ALBUFEIRA, '2026-01-15')).toBe(0)
  })

  it('alterna entre épocas em Loulé', () => {
    expect(valorDaNoite(LOULE, '2026-08-15')).toBe(2)
    expect(valorDaNoite(LOULE, '2026-01-15')).toBe(1)
  })
})

describe('calcularTmt', () => {
  it('calcula o caso simples', () => {
    // 3 noites × 2 pessoas × 4 €
    const r = calcularTmt(reserva('2026-08-01', '2026-08-04', 2), LISBOA)
    expect(r.valor).toBe(24)
    expect(r.noitesTributaveis).toBe(3)
    expect(r.pessoasCobradas).toBe(2)
  })

  it('aplica o limite de noites', () => {
    // 10 noites, mas Lisboa só cobra 7
    const r = calcularTmt(reserva('2026-08-01', '2026-08-11', 1), LISBOA)
    expect(r.noitesTributaveis).toBe(7)
    expect(r.noitesIsentas).toBe(3)
    expect(r.valor).toBe(28)
  })

  it('avisa quando a estadia ultrapassa o limite', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-11', 1), LISBOA)
    expect(r.avisos.some(a => a.includes('limite'))).toBe(true)
  })

  it('desconta hóspedes isentos', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-04', 4), LISBOA, { pessoasIsentas: 2 })
    expect(r.pessoasCobradas).toBe(2)
    expect(r.valor).toBe(24)
  })

  it('avisa sobre menores quando não há isenções declaradas', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-04', 4), LISBOA)
    expect(r.avisos.some(a => a.includes('Menores de 13'))).toBe(true)
  })

  it('não avisa sobre menores numa reserva individual', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-04', 1), LISBOA)
    expect(r.avisos.some(a => a.includes('Menores'))).toBe(false)
  })

  it('nunca isenta mais pessoas do que as que existem', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-04', 2), LISBOA, { pessoasIsentas: 99 })
    expect(r.pessoasCobradas).toBe(0)
    expect(r.valor).toBe(0)
  })

  it('não cobra fora da época em Albufeira', () => {
    const r = calcularTmt(reserva('2026-01-05', '2026-01-10', 2), ALBUFEIRA)
    expect(r.valor).toBe(0)
    expect(r.noitesTributaveis).toBe(0)
  })

  it('cobra só as noites dentro da época numa estadia que atravessa a fronteira', () => {
    // 29/10 a 02/11: noites 29, 30, 31 dentro da época; 1 de nov fora
    const r = calcularTmt(reserva('2026-10-29', '2026-11-02', 1), ALBUFEIRA)
    expect(r.noitesTributaveis).toBe(3)
    expect(r.valor).toBe(6)
  })

  it('mistura valores de época diferente em Loulé', () => {
    // 30/10 (2 €), 31/10 (2 €), 01/11 (1 €), 02/11 (1 €) = 6 € para 1 pessoa
    const r = calcularTmt(reserva('2026-10-30', '2026-11-03', 1), LOULE)
    expect(r.valor).toBe(6)
    expect(r.noitesTributaveis).toBe(4)
  })

  it('respeita o limite mais curto de Loulé', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-10', 1), LOULE)
    expect(r.noitesTributaveis).toBe(5)
    expect(r.valor).toBe(10)
  })

  it('assume uma pessoa quando num_hospedes é zero', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-03', 0), LISBOA)
    expect(r.pessoasCobradas).toBe(1)
    expect(r.valor).toBe(8)
  })

  it('devolve zero para estadia de zero noites', () => {
    const r = calcularTmt(reserva('2026-08-01', '2026-08-01', 2), LISBOA)
    expect(r.valor).toBe(0)
    expect(r.noitesTributaveis).toBe(0)
  })

  it('atravessa a fronteira do ano sem erro', () => {
    const r = calcularTmt(reserva('2026-12-30', '2027-01-02', 1), LISBOA)
    expect(r.noitesTributaveis).toBe(3)
    expect(r.valor).toBe(12)
  })

  describe('filtro por mês (mapa mensal)', () => {
    it('conta só as noites do mês pedido', () => {
      // 30/07 a 03/08: 2 noites em julho, 2 em agosto
      const b = reserva('2026-07-30', '2026-08-03', 1)
      expect(calcularTmt(b, LISBOA, { ano: 2026, mes: 6 }).valor).toBe(8)
      expect(calcularTmt(b, LISBOA, { ano: 2026, mes: 7 }).valor).toBe(8)
    })

    it('aplica o limite de noites à estadia inteira, não ao mês', () => {
      // 10 noites a partir de 28/07: só as 7 primeiras contam (até 03/08).
      // Em agosto caem as noites 1, 2 e 3 → 3 noites tributáveis.
      const b = reserva('2026-07-28', '2026-08-07', 1)
      const agosto = calcularTmt(b, LISBOA, { ano: 2026, mes: 7 })
      expect(agosto.noitesTributaveis).toBe(3)
      expect(agosto.valor).toBe(12)
    })

    it('devolve zero para um mês sem noites da estadia', () => {
      const b = reserva('2026-07-01', '2026-07-05', 2)
      expect(calcularTmt(b, LISBOA, { ano: 2026, mes: 8 }).valor).toBe(0)
    })
  })

  it('arredonda a dois decimais', () => {
    const regra: RegraTmt = {
      concelho: 'Teste', valor: 1.335, maxNoites: 7, isencaoIdade: 13,
      fonte: 'teste', verificadoEm: '2026-07-28',
    }
    const r = calcularTmt(reserva('2026-08-01', '2026-08-02', 1), regra)
    expect(r.valor).toBe(1.34)
  })
})
