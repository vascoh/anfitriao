import { describe, it, expect } from 'vitest'
import { chaveDeNome, semAcentos } from './nomes'

describe('chaveDeNome', () => {
  it('reconhece o mesmo nome escrito de outra maneira', () => {
    // O hóspede que reenvia o formulário raramente escreve o nome igual.
    expect(chaveDeNome('João Silva')).toBe(chaveDeNome('joao  SILVA'))
    expect(chaveDeNome(' Ana Sá ')).toBe(chaveDeNome('ana sa'))
  })

  it('não junta pessoas diferentes', () => {
    expect(chaveDeNome('Ana Silva')).not.toBe(chaveDeNome('Ana Sousa'))
    expect(chaveDeNome('João Silva')).not.toBe(chaveDeNome('João Silva Jr'))
  })

  it('aguenta o que não é texto', () => {
    expect(chaveDeNome(null)).toBe('')
    expect(chaveDeNome(undefined)).toBe('')
    expect(chaveDeNome(42)).toBe('')
    expect(chaveDeNome('   ')).toBe('')
  })
})

describe('semAcentos', () => {
  it('tira os acentos e deixa o resto', () => {
    expect(semAcentos('praça')).toBe('praca')
    expect(semAcentos('Ericeira')).toBe('Ericeira')
  })
})
