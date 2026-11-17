import { describe, it, expect } from 'vitest'
import { PAISES_FREQUENTES } from './campo-pais'
import { listaPaises } from '@/lib/paises'

describe('CampoPais', () => {
  it('os países frequentes existem na lista completa', () => {
    const codigos = new Set(listaPaises('pt').map((p) => p.codigo))
    for (const c of PAISES_FREQUENTES) expect(codigos.has(c)).toBe(true)
  })
})
