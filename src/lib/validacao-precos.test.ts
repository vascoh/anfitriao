import { describe, it, expect } from 'vitest'
import {
  validarRegraPreco, validarComissao, validarMultiplicador,
  DESCONTO_MIN, DESCONTO_MAX,
} from './validacao-precos'

describe('validarRegraPreco', () => {
  it('aceita uma regra normal', () => {
    expect(validarRegraPreco({
      nome: 'Verão', preco_noite: 150, data_inicio: '2026-06-01', data_fim: '2026-09-30',
      min_noites: 2, max_noites: 14, dias_semana: [5, 6], prioridade: 10,
    })).toBeNull()
  })

  it('recusa o desconto que faz o preço ficar negativo', () => {
    // A atualização em massa deixava escrever isto a partir da interface.
    const p = validarRegraPreco({ desconto_pct: -150 })
    expect(p?.campo).toBe('desconto_pct')
  })

  it('aceita os extremos do intervalo', () => {
    expect(validarRegraPreco({ desconto_pct: DESCONTO_MIN })).toBeNull()
    expect(validarRegraPreco({ desconto_pct: DESCONTO_MAX })).toBeNull()
    expect(validarRegraPreco({ desconto_pct: DESCONTO_MAX + 1 })?.campo).toBe('desconto_pct')
  })

  it('recusa preços negativos e absurdos', () => {
    expect(validarRegraPreco({ preco_noite: -1 })?.campo).toBe('preco_noite')
    expect(validarRegraPreco({ preco_noite: 1e9 })?.campo).toBe('preco_noite')
    expect(validarRegraPreco({ taxa_limpeza: -10 })?.campo).toBe('taxa_limpeza')
  })

  it('recusa NaN, que é o que sai de um campo vazio convertido com Number()', () => {
    expect(validarRegraPreco({ preco_noite: NaN })?.campo).toBe('preco_noite')
    expect(validarRegraPreco({ desconto_pct: Infinity })?.campo).toBe('desconto_pct')
  })

  it('recusa datas invertidas — uma regra que nunca se aplica', () => {
    /* Não dá erro nenhum na app: dá uma promoção que o anfitrião pensa estar
     * a funcionar e que nunca aparece a ninguém. */
    const p = validarRegraPreco({ data_inicio: '2026-09-30', data_fim: '2026-06-01' })
    expect(p?.campo).toBe('data_fim')
  })

  it('aceita um intervalo com início e fim no mesmo dia', () => {
    expect(validarRegraPreco({ data_inicio: '2026-06-01', data_fim: '2026-06-01' })).toBeNull()
  })

  it('recusa mínimo de noites maior que o máximo', () => {
    expect(validarRegraPreco({ min_noites: 10, max_noites: 3 })?.campo).toBe('max_noites')
  })

  it('recusa dias da semana fora de 0–6', () => {
    expect(validarRegraPreco({ dias_semana: [1, 7] })?.campo).toBe('dias_semana')
    expect(validarRegraPreco({ dias_semana: 'segunda' })?.campo).toBe('dias_semana')
  })

  it('campos ausentes não são problema — a regra pode ser mínima', () => {
    expect(validarRegraPreco({ nome: 'Só nome' })).toBeNull()
  })
})

describe('validarComissao', () => {
  it('aceita 0 a 100', () => {
    expect(validarComissao(0)).toBeNull()
    expect(validarComissao(15)).toBeNull()
    expect(validarComissao(100)).toBeNull()
  })

  it('recusa fora do intervalo', () => {
    // Uma comissão de 150% dava lucro líquido negativo no /financeiro.
    expect(validarComissao(-1)?.campo).toBe('comissao_pct')
    expect(validarComissao(150)?.campo).toBe('comissao_pct')
  })
})

describe('validarMultiplicador', () => {
  it('aceita a gama útil', () => {
    expect(validarMultiplicador(1)).toBeNull()
    expect(validarMultiplicador(1.18)).toBeNull()
  })

  it('recusa zero e valores absurdos', () => {
    // Multiplicador 0 zerava o preço de todas as reservas da plataforma.
    expect(validarMultiplicador(0)?.campo).toBe('multiplicador')
    expect(validarMultiplicador(100)?.campo).toBe('multiplicador')
  })
})
