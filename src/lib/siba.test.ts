import { describe, it, expect } from 'vitest'
import { escCsv, normalizeDate, buildSibaCsv, SIBA_HEADER } from './siba'

describe('escCsv', () => {
  it('envolve valores em aspas e duplica aspas internas', () => {
    expect(escCsv('João "Zé" Silva')).toBe('"João ""Zé"" Silva"')
    expect(escCsv('simples')).toBe('"simples"')
  })

  it('trata null/undefined como vazio', () => {
    expect(escCsv(null)).toBe('""')
    expect(escCsv(undefined)).toBe('""')
  })

  it('neutraliza formula injection (Excel/Sheets)', () => {
    expect(escCsv('=cmd|/C calc!A0')).toBe(`"'=cmd|/C calc!A0"`)
    expect(escCsv('+351911111111')).toBe(`"'+351911111111"`)
    expect(escCsv('-2+3')).toBe(`"'-2+3"`)
    expect(escCsv('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
  })

  it('não altera texto normal com símbolos no meio', () => {
    expect(escCsv('Rua 5, nº 3 = casa')).toBe('"Rua 5, nº 3 = casa"')
  })
})

describe('normalizeDate', () => {
  it('converte DD/MM/YYYY para YYYY-MM-DD', () => {
    expect(normalizeDate('15/05/1990')).toBe('1990-05-15')
    expect(normalizeDate('1/2/1990')).toBe('1990-02-01')
  })

  it('passa através ISO e vazio', () => {
    expect(normalizeDate('1990-05-15')).toBe('1990-05-15')
    expect(normalizeDate('')).toBe('')
    expect(normalizeDate(null)).toBe('')
  })

  it('devolve o original se o formato com / for inválido', () => {
    expect(normalizeDate('15/05')).toBe('15/05')
  })
})

describe('buildSibaCsv', () => {
  const row = {
    check_in: '2026-08-10',
    check_out: '2026-08-12',
    num_hospedes: 2,
    alojamento: 'Casa do Mar',
    nome: 'João Silva',
    data_nascimento: '15/05/1990',
    nacionalidade: 'Portugal',
    numero_documento: 'AB123456',
    tipo_documento: 'Passaporte',
    data_validade_doc: '2030-01-01',
    sexo: 'M',
    pais_emissao: 'PT',
  }

  it('gera BOM + header + linhas com CRLF', () => {
    const csv = buildSibaCsv([row])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('"Check-in"')
    expect(lines[0].split(',')).toHaveLength(SIBA_HEADER.length)
    expect(lines[1]).toContain('"João Silva"')
    expect(lines[1]).toContain('"1990-05-15"') // data OCR normalizada
  })

  it('neutraliza nomes maliciosos de hóspedes', () => {
    const csv = buildSibaCsv([{ ...row, nome: '=HYPERLINK("http://evil")' }])
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })

  it('aguenta campos em falta', () => {
    const csv = buildSibaCsv([{ ...row, nacionalidade: null, sexo: undefined, data_nascimento: null }])
    const dataLine = csv.split('\r\n')[1]
    expect(dataLine.split(',')).toHaveLength(SIBA_HEADER.length)
  })
})
