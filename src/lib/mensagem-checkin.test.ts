import { describe, it, expect } from 'vitest'
import { mensagemDeCheckin } from './mensagem-checkin'

const base = { alojamento: 'Quarto de Casal', checkIn: '2026-11-19', checkOut: '2026-11-22', link: 'https://anfitrioes.pt/checkin/abc' }

describe('mensagemDeCheckin', () => {
  it('cumprimenta pelo primeiro nome e leva o link e as noites', () => {
    const m = mensagemDeCheckin({ ...base, nome: 'Hans Müller' })
    expect(m.startsWith('Olá Hans!')).toBe(true)
    expect(m).toContain('Quarto de Casal')
    expect(m).toContain('(3 noites)')
    expect(m).toContain('https://anfitrioes.pt/checkin/abc')
  })

  it('sem nome não inventa um', () => {
    expect(mensagemDeCheckin({ ...base, nome: '  ' }).startsWith('Olá! ')).toBe(true)
  })

  it('acrescenta as instruções só quando existem, e no singular diz «noite»', () => {
    expect(mensagemDeCheckin({ ...base, checkOut: '2026-11-20', instrucoes: 'Chave no cofre 1234' })).toMatch(/\(1 noite\)\.\n\nChave no cofre 1234\n\n/)
    expect(mensagemDeCheckin({ ...base, instrucoes: null })).not.toMatch(/\n\n\n/)
  })
})
