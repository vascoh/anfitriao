import { describe, it, expect } from 'vitest'
import { normalizarSlug, validarSlug } from './slug'

describe('normalizarSlug', () => {
  it('deixa em paz um slug já correto', () => {
    expect(normalizarSlug('casa-de-vasco')).toBe('casa-de-vasco')
  })

  it('o vazio é null, não cadeia vazia', () => {
    /* A coluna tem UNIQUE. Dois NULL não colidem em Postgres, duas cadeias
     * vazias colidem: o segundo cliente que apagasse o endereço deixava de
     * conseguir gravar a página inteira, com um erro que não explica nada. */
    expect(normalizarSlug('')).toBeNull()
    expect(normalizarSlug('   ')).toBeNull()
    expect(normalizarSlug(null)).toBeNull()
    expect(normalizarSlug(undefined)).toBeNull()
    expect(normalizarSlug('---')).toBeNull()
  })

  it('minúsculas, sem acentos e sem espaços', () => {
    expect(normalizarSlug('Casa da Praça')).toBe('casa-da-praca')
  })

  it('uma barra deixaria o site inacessível', () => {
    // /r/a/b não corresponde a rota nenhuma: 404 sem explicação.
    expect(normalizarSlug('a/b')).toBe('a-b')
  })

  it('não deixa hífens soltos nas pontas nem repetidos', () => {
    expect(normalizarSlug('--casa--do--mar--')).toBe('casa-do-mar')
  })

  it('corta no máximo sem deixar hífen pendurado', () => {
    const longo = 'a'.repeat(38) + '-bbbb'
    const s = normalizarSlug(longo)!
    expect(s.length).toBeLessThanOrEqual(40)
    expect(s.endsWith('-')).toBe(false)
  })

  it('ignora o que não é texto', () => {
    expect(normalizarSlug(42)).toBeNull()
    expect(normalizarSlug({})).toBeNull()
  })
})

describe('validarSlug', () => {
  it('sem endereço é permitido', () => {
    expect(validarSlug(null)).toBeNull()
  })

  it('recusa endereços curtos de mais', () => {
    expect(validarSlug('ab')).toContain('3')
  })

  it('aceita a partir do mínimo', () => {
    expect(validarSlug('abc')).toBeNull()
  })
})
