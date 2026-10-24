import { describe, it, expect } from 'vitest'
import { nomeComodidade } from './comodidades'

describe('nome das comodidades', () => {
  it('conhecidas traduzem; escritas à mão ficam legíveis', () => {
    expect(nomeComodidade('ar_condicionado', 'en')).toBe('Air conditioning')
    expect(nomeComodidade('roupa_cama', 'pt')).toBe('Roupa cama')
  })
})
