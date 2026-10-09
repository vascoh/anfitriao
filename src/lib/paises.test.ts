import { describe, it, expect } from 'vitest'
import { codigoDePais, eCodigoPais, listaPaises, nomePais } from './paises'
import { codigoPais } from './siba-xml'

describe('paises', () => {
  it('a lista não tem códigos repetidos e cobre a ISO 3166-1', () => {
    const lista = listaPaises('pt')
    expect(new Set(lista.map(p => p.codigo)).size).toBe(lista.length)
    expect(lista.length).toBeGreaterThanOrEqual(249)
  })

  it('nomes em português e inglês', () => {
    expect(nomePais('DEU', 'pt')).toBe('Alemanha')
    expect(nomePais('DEU', 'en')).toBe('Germany')
    expect(nomePais('XYZ')).toBe('XYZ')
  })

  it('lê o que os hóspedes escrevem, em português ou inglês', () => {
    expect(codigoDePais('Germany')).toBe('DEU')
    expect(codigoDePais('alemanha')).toBe('DEU')
    expect(codigoDePais('United Kingdom')).toBe('GBR')
    expect(codigoDePais('UK')).toBe('GBR')
    expect(codigoDePais('Estados Unidos')).toBe('USA')
    expect(codigoDePais('United States')).toBe('USA')
    expect(codigoDePais('  França ')).toBe('FRA')
    expect(codigoDePais('Países Baixos')).toBe('NLD')
    expect(codigoDePais('Netherlands')).toBe('NLD')
    expect(codigoDePais('bra')).toBe('BRA')
  })

  it('não adivinha', () => {
    expect(codigoDePais('Atlântida')).toBeUndefined()
    expect(codigoDePais('')).toBeUndefined()
    expect(codigoDePais('XYZ')).toBeUndefined()
    expect(eCodigoPais('XYZ')).toBe(false)
    expect(eCodigoPais('PRT')).toBe(true)
  })

  it('o SIBA passa a aceitar nomes em inglês', () => {
    /* Antes, «Germany» escrito por um hóspede alemão dava boletim sem
     * nacionalidade, e o anfitrião só sabia ao tentar entregar. */
    expect(codigoPais('Germany')).toBe('DEU')
    expect(codigoPais('Ireland')).toBe('IRL')
    expect(codigoPais('Alemanha')).toBe('DEU')
  })
})
