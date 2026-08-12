import { describe, it, expect } from 'vitest'
import {
  compararCusto,
  planoParaUnidades,
  MAX_UNIDADES,
} from './comparador-precos'
import { PLAN_LIMITS, PLAN_PRICE_EUR } from './planos'

describe('planoParaUnidades', () => {
  it('escolhe o plano mais barato que comporta as unidades', () => {
    expect(planoParaUnidades(1)).toBe('starter')
    expect(planoParaUnidades(PLAN_LIMITS.starter.propriedades_max)).toBe('starter')
    expect(planoParaUnidades(PLAN_LIMITS.starter.propriedades_max + 1)).toBe('pro')
    expect(planoParaUnidades(PLAN_LIMITS.pro.propriedades_max + 1)).toBe('empresa')
  })

  it('acima do maior plano devolve null — a resposta é falar connosco', () => {
    // Empurrar o Empresa para quem ele não serve seria vender o que não se
    // entrega (não há RBAC nem portal de proprietário).
    expect(planoParaUnidades(PLAN_LIMITS.empresa.propriedades_max + 1)).toBeNull()
  })

  it('arredonda para cima — meia unidade continua a ser uma unidade', () => {
    expect(planoParaUnidades(3.2)).toBe('pro')
  })
})

describe('compararCusto', () => {
  it('com um alojamento, pagar por conta sai mais caro — e diz-se', () => {
    const r = compararCusto({ unidades: 1, precoPorUnidade: 10 })
    expect(r.custoAnfitriao).toBe(PLAN_PRICE_EUR.starter)
    expect(r.custoPorUnidade).toBe(10)
    expect(r.poupancaMes).toBeLessThan(0)
    expect(r.naoCompensa).toBe(true)
  })

  it('com oito alojamentos, a diferença é o argumento todo', () => {
    const r = compararCusto({ unidades: 8, precoPorUnidade: 10 })
    expect(r.plano).toBe('pro')
    expect(r.custoPorUnidade).toBe(80)
    expect(r.custoAnfitriao).toBe(PLAN_PRICE_EUR.pro)
    expect(r.poupancaMes).toBe(80 - PLAN_PRICE_EUR.pro)
    expect(r.poupancaAno).toBe((80 - PLAN_PRICE_EUR.pro) * 12)
    expect(r.naoCompensa).toBe(false)
  })

  it('empate conta como não compensar', () => {
    // 19 € contra 19 €: não há poupança nenhuma, e fingir que há seria mentir.
    const r = compararCusto({ unidades: 1, precoPorUnidade: PLAN_PRICE_EUR.starter })
    expect(r.poupancaMes).toBe(0)
    expect(r.naoCompensa).toBe(true)
  })

  it('o preço anual muda a conta a favor de quem paga adiantado', () => {
    const mensal = compararCusto({ unidades: 10, precoPorUnidade: 10 })
    const anual = compararCusto({ unidades: 10, precoPorUnidade: 10, anual: true })
    expect(anual.poupancaMes).toBeGreaterThan(mensal.poupancaMes)
  })

  it('acima do maior plano não inventa um preço', () => {
    const r = compararCusto({ unidades: MAX_UNIDADES, precoPorUnidade: 10 })
    expect(r.plano).toBe('empresa')

    const acima = compararCusto({ unidades: 999, precoPorUnidade: 10 })
    // Limitado ao máximo em vez de produzir um número fantasista.
    expect(acima.unidades).toBe(MAX_UNIDADES)
  })

  it('preço efetivo por unidade desce à medida que o plano se enche', () => {
    const tres = compararCusto({ unidades: 3, precoPorUnidade: 10 })
    const dez = compararCusto({ unidades: 10, precoPorUnidade: 10 })
    expect(dez.precoEfetivoPorUnidade!).toBeLessThan(tres.precoEfetivoPorUnidade!)
  })

  it('aguenta entradas absurdas sem rebentar', () => {
    expect(compararCusto({ unidades: 0, precoPorUnidade: -5 }).unidades).toBe(1)
    expect(compararCusto({ unidades: NaN, precoPorUnidade: NaN }).custoPorUnidade).toBe(0)
    expect(compararCusto({ unidades: 1e9, precoPorUnidade: 1e9 }).unidades).toBe(MAX_UNIDADES)
  })
})
