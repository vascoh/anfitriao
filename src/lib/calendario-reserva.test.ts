import { describe, it, expect } from 'vitest'
import {
  gradeDoMes, somarMeses, escolherDia, diaDisponivel, dentroDaSelecao, SEM_SELECAO,
} from './calendario-reserva'

const ocupadas = ['2026-11-12', '2026-11-13']
const set = new Set(ocupadas)

describe('calendário de reserva', () => {
  it('grelha começa à segunda e fecha a semana', () => {
    const g = gradeDoMes(2026, 10) // novembro de 2026 começa a um domingo
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(g.length % 7).toBe(0)
    expect(g.filter(Boolean)).toHaveLength(30)
  })

  it('soma meses atravessando o ano', () => {
    expect(somarMeses(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 })
    expect(somarMeses(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 })
  })

  it('primeiro clique é a entrada; segundo, a saída', () => {
    const a = escolherDia(SEM_SELECAO, '2026-11-05', ocupadas).selecao
    expect(a).toEqual({ entrada: '2026-11-05', saida: null })
    expect(escolherDia(a, '2026-11-08', ocupadas).selecao).toEqual({ entrada: '2026-11-05', saida: '2026-11-08' })
  })

  it('a saída pode ser o primeiro dia ocupado, mas não depois dele', () => {
    const a = { entrada: '2026-11-10', saida: null }
    expect(escolherDia(a, '2026-11-12', ocupadas).selecao.saida).toBe('2026-11-12')
    const r = escolherDia(a, '2026-11-15', ocupadas)
    expect(r.atravessa).toBe(true)
    expect(r.selecao).toEqual(a)
  })

  it('clicar antes da entrada recomeça a escolha', () => {
    const a = { entrada: '2026-11-10', saida: null }
    expect(escolherDia(a, '2026-11-03', ocupadas).selecao).toEqual({ entrada: '2026-11-03', saida: null })
  })

  it('dias disponíveis respeitam antecedência, ocupação e limite de saída', () => {
    expect(diaDisponivel('2026-11-01', SEM_SELECAO, '2026-11-02', set, ocupadas)).toBe(false)
    expect(diaDisponivel('2026-11-12', SEM_SELECAO, '2026-11-01', set, ocupadas)).toBe(false)
    const a = { entrada: '2026-11-10', saida: null }
    expect(diaDisponivel('2026-11-12', a, '2026-11-01', set, ocupadas)).toBe(true)
    expect(diaDisponivel('2026-11-14', a, '2026-11-01', set, ocupadas)).toBe(false)
  })

  it('dentro da seleção exclui as pontas', () => {
    const s = { entrada: '2026-11-05', saida: '2026-11-08' }
    expect(dentroDaSelecao('2026-11-05', s)).toBe(false)
    expect(dentroDaSelecao('2026-11-06', s)).toBe(true)
    expect(dentroDaSelecao('2026-11-08', s)).toBe(false)
  })
})
