import { describe, it, expect } from 'vitest'
import {
  PARAMETROS_2026 as P, coletaIrs, coletaEscaloes, taxaSolidariedade, coeficiente, mapaFiscal, parametrosDoAno,
  type AlojamentoFiscal, type Agregado,
} from './fiscal-irs'

const AGREGADO: Agregado = { outrosRendimentos: 0, conjunta: false, contribuicoesSs: 0, despesasNoEfatura: true }

function al(over: Partial<AlojamentoFiscal> = {}): AlojamentoFiscal {
  return {
    id: 'p1', nome: 'T1', modalidade: 'apartamento', areaContencao: false,
    vpt: null, receita: 20_000, despesas: 0, ...over,
  }
}

describe('coletaIrs — art. 68.º (2026)', () => {
  it('bate com a coluna B (taxa média) publicada na lei, em cada limite de escalão', () => {
    // A coluna B é independente da nossa soma por escalões: se os limites ou as
    // taxas estiverem mal copiados, isto falha.
    const colunaB: Array<[number, number]> = [
      [8342, 0.125], [12587, 0.13579], [17838, 0.15823], [23089, 0.17705],
      [29397, 0.20579], [43090, 0.2513], [46566, 0.26472], [86634, 0.34856],
    ]
    for (const [rc, media] of colunaB) {
      // a coluna B tem 3 casas decimais de percentagem: tolerância de 0,0005 %
      expect(Math.abs(coletaEscaloes(rc, P) - rc * media)).toBeLessThan(rc * 0.000005 + 0.5)
    }
  })

  it('aplica a taxa adicional de solidariedade acima de 80 000 € (art. 68.º-A)', () => {
    expect(taxaSolidariedade(80_000)).toBe(0)
    expect(taxaSolidariedade(100_000)).toBeCloseTo(500, 9)
    expect(taxaSolidariedade(300_000)).toBeCloseTo(170_000 * 0.025 + 50_000 * 0.05, 9)
    expect(coletaIrs(120_000, false, P) - coletaIrs(100_000, false, P)).toBeCloseTo(20_000 * (0.48 + 0.025), 6)
    expect(coletaIrs(300_000, false, P) - coletaIrs(250_000, false, P)).toBeCloseTo(50_000 * (0.48 + 0.05), 6)
  })

  it('tributação conjunta usa o quociente conjugal (art. 69.º)', () => {
    expect(coletaIrs(40_000, true, P)).toBeCloseTo(2 * coletaIrs(20_000, false, P), 9)
  })

  it('rendimento negativo não dá coleta negativa', () => {
    expect(coletaIrs(-1000, false, P)).toBe(0)
  })
})

describe('coeficiente — art. 31.º, n.º 1', () => {
  it('moradia/apartamento: 0,35 pela alínea c)', () => {
    expect(coeficiente('apartamento', false)).toEqual({ valor: 0.35, alinea: 'c' })
    expect(coeficiente('moradia', false)).toEqual({ valor: 0.35, alinea: 'c' })
  })
  it('em área de contenção: 0,50 pela alínea h)', () => {
    expect(coeficiente('apartamento', true)).toEqual({ valor: 0.5, alinea: 'h' })
  })
  it('hospedagem e quartos: 0,15 pela alínea a), mesmo em área de contenção', () => {
    expect(coeficiente('hospedagem', true)).toEqual({ valor: 0.15, alinea: 'a' })
    expect(coeficiente('quartos', false)).toEqual({ valor: 0.15, alinea: 'a' })
  })
})

describe('mapaFiscal — categoria B', () => {
  it('sem acréscimo quando a dedução específica já cobre os 15 %', () => {
    // 15 % de 20 000 = 3 000 < 8,54 × 537,13 = 4 587,09
    const m = mapaFiscal([al()], AGREGADO, P)
    expect(m.b.rendimento).toBeCloseTo(7000, 6)
    expect(m.b.acrescimoN13).toBe(0)
  })

  it('acresce a diferença dos 15 % quando as despesas não chegam (n.º 13)', () => {
    const m = mapaFiscal([al({ receita: 50_000 })], { ...AGREGADO, despesasNoEfatura: false }, P)
    expect(m.b.acrescimoN13).toBeCloseTo(7500 - 8.54 * 537.13, 6)
    expect(m.b.rendimento).toBeCloseTo(17_500 + 7500 - 8.54 * 537.13, 6)
  })

  it('4 % do VPT e as despesas no e-fatura contam para o n.º 13', () => {
    const m = mapaFiscal([al({ receita: 50_000, vpt: 50_000, despesas: 1000 })], AGREGADO, P)
    // 7 500 − (4 587,09 + 2 000 + 1 000) < 0 → sem acréscimo
    expect(m.b.acrescimoN13).toBe(0)
  })

  it('a área de contenção (alínea h) não tem regra dos 15 %', () => {
    const m = mapaFiscal([al({ receita: 100_000, areaContencao: true })], { ...AGREGADO, despesasNoEfatura: false }, P)
    expect(m.b.rendimento).toBeCloseTo(50_000, 6)
    expect(m.b.acrescimoN13).toBe(0)
  })

  it('o imposto é o incremental sobre os outros rendimentos do agregado', () => {
    const agregado = { ...AGREGADO, outrosRendimentos: 50_000 }
    const m = mapaFiscal([al()], agregado, P)
    expect(m.b.imposto).toBeCloseTo(7000 * 0.446, 6) // tudo dentro do escalão de 44,6 %
  })
})

describe('mapaFiscal — opção pela categoria F (art. 28.º, n.º 14)', () => {
  it('rendimento baixo: B ganha, e na F o englobamento bate os 28 %', () => {
    const m = mapaFiscal([al({ despesas: 6000 })], AGREGADO, P)
    expect(m.f.rendimentoF).toBe(14_000)
    expect(m.f.impostoAutonomo).toBeCloseTo(14_000 * 0.28, 6)
    expect(m.f.modo).toBe('englobamento')
    expect(m.recomendacao).toBe('B')
  })

  it('escalão alto e despesas altas: a F a 28 % ganha', () => {
    const agregado = { ...AGREGADO, outrosRendimentos: 100_000 }
    const m = mapaFiscal([al({ despesas: 12_000 })], agregado, P)
    expect(m.b.imposto).toBeCloseTo(7000 * (0.48 + 0.025), 6)
    expect(m.f.imposto).toBeCloseTo(8000 * 0.28, 6)
    expect(m.f.modo).toBe('autonoma')
    expect(m.recomendacao).toBe('F')
    expect(m.poupancaF).toBeCloseTo(7000 * 0.505 - 8000 * 0.28, 6)
  })

  it('hospedagem e quartos não podem optar: F indisponível', () => {
    const m = mapaFiscal([al({ modalidade: 'hospedagem' })], AGREGADO, P)
    expect(m.f.disponivel).toBe(false)
    expect(m.recomendacao).toBe('indiferente')
  })

  it('misto: a hospedagem fica na B quando a moradia passa para a F', () => {
    const m = mapaFiscal(
      [al({ id: 'a', modalidade: 'moradia', despesas: 5000 }), al({ id: 'b', modalidade: 'hospedagem', receita: 10_000 })],
      AGREGADO, P,
    )
    expect(m.f.rendimentoBRestante).toBeCloseTo(1500, 6)
    expect(m.f.rendimentoF).toBe(15_000)
  })

  it('prejuízo na F: sem imposto e com aviso de reporte', () => {
    const m = mapaFiscal([al({ despesas: 25_000 })], AGREGADO, P)
    expect(m.f.rendimentoF).toBe(0)
    expect(m.f.prejuizoF).toBe(5000)
    expect(m.avisos.some(a => a.includes('art. 55.º'))).toBe(true)
  })
})

it('não inventa parâmetros para anos não verificados', () => {
  expect(parametrosDoAno(2026)).not.toBeNull()
  expect(parametrosDoAno(2027)).toBeNull()
})
