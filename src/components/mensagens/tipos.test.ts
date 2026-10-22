import { describe, expect, it } from 'vitest'
import { quando } from './tipos'

describe('quando', () => {
  it('mostra a hora para uma mensagem de hoje em Lisboa', () => {
    expect(quando('2026-07-10T08:05:00Z', new Date('2026-07-10T20:00:00Z'))).toBe('09:05')
  })

  it('reconhece ontem no dia com 25 horas da mudança de hora', () => {
    // Às 23:30 de 25/10 em Lisboa já passaram 25 horas desde as 23:30 do dia
    // anterior. Subtrair 24 horas ao relógio apontava ainda para dia 25.
    expect(quando('2026-10-24T12:00:00Z', new Date('2026-10-25T23:30:00Z'))).toBe('ontem')
  })
})
