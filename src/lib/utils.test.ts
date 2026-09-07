import { describe, it, expect } from 'vitest'
import { nights, addDays, parseDate, today, escHtml, fmtMoney, fmtDate, uuid } from './utils'

describe('nights', () => {
  it('counts nights between check-in and check-out', () => {
    expect(nights('2026-07-10', '2026-07-13')).toBe(3)
  })

  it('returns 0 for same-day', () => {
    expect(nights('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('returns negative for inverted dates', () => {
    expect(nights('2026-07-13', '2026-07-10')).toBe(-3)
  })

  it('handles DST transitions without off-by-one', () => {
    // Europe/Lisbon DST starts last Sunday of March
    expect(nights('2026-03-28', '2026-03-30')).toBe(2)
    // DST ends last Sunday of October
    expect(nights('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('crosses month and year boundaries', () => {
    expect(nights('2026-12-31', '2027-01-02')).toBe(2)
  })
})

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-07-10', 5)).toBe('2026-07-15')
  })

  it('rolls over month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('rolls over year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('subtracts with negative n', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
  })
})

describe('parseDate / today', () => {
  it('parses ISO date to local midnight', () => {
    const d = parseDate('2026-07-10')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(0)
  })

  it('today returns YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('today devolve a data local, não a UTC', () => {
    const d = new Date()
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(today()).toBe(local)
  })
})

describe('escHtml', () => {
  it('escapes all dangerous characters', () => {
    expect(escHtml(`<script>alert("x&y'")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&#39;&quot;)&lt;/script&gt;',
    )
  })

  it('handles null and undefined', () => {
    expect(escHtml(null)).toBe('')
    expect(escHtml(undefined)).toBe('')
  })

  it('passes through safe text', () => {
    expect(escHtml('Olá, mundo')).toBe('Olá, mundo')
  })
})

describe('fmtMoney', () => {
  const semEspacos = (n: number) => fmtMoney(n).replace(/\s/g, '')

  it('um total redondo continua sem casas decimais', () => {
    // pt-PT usa espaços não-quebráveis; compara-se só dígitos e símbolo
    expect(semEspacos(1250)).toBe('1250€')
  })

  it('mostra os cêntimos quando os há, em vez de arredondar', () => {
    // Era «20 €» por um saldo de 19,60 €: o lembrete de pagamento pedia ao
    // hóspede um valor que não era o que ele devia.
    expect(semEspacos(19.6)).toBe('19,60€')
    expect(semEspacos(4.2)).toBe('4,20€')
    expect(semEspacos(149.5)).toBe('149,50€')
  })

  it('o que arredonda ao cêntimo para um valor redondo mostra-se redondo', () => {
    // 19,999 não é um valor em dinheiro: ao cêntimo são 20,00 €, e «20 €» diz
    // exatamente isso. A decisão é tomada depois do arredondamento, não sobre
    // o float — senão o resíduo binário de somas como 0,1+0,2 punha «,00» em
    // toda a parte.
    expect(semEspacos(19.999)).toBe('20€')
    expect(semEspacos(0.1 + 0.2 + 19.7)).toBe('20€')
  })

  it('zero e negativos mantêm o formato', () => {
    expect(semEspacos(0)).toBe('0€')
    expect(semEspacos(-12.5)).toBe('-12,50€')
  })
})

describe('fmtDate', () => {
  it('formats in pt-PT day + month (ICU renders day/month numerically)', () => {
    const out = fmtDate('2026-07-10')
    expect(out).toContain('10')
    expect(out.toLowerCase()).toMatch(/jul|07/)
  })

  it('respects custom format options', () => {
    const out = fmtDate('2026-07-10', { year: 'numeric', month: 'long', day: 'numeric' })
    expect(out).toContain('2026')
    expect(out.toLowerCase()).toContain('julho')
  })
})

describe('uuid', () => {
  it('generates valid v4 uuids', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
