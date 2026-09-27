import { describe, it, expect } from 'vitest'
import { validarReservaNoBloqueio, aindaDentro, type BloqueioParaValidar } from './reserva-no-bloqueio'
import { occupancyForMonth } from './reservations'
import type { Booking } from './types'

const BLOQUEIO: BloqueioParaValidar = {
  id: 'blq', propriedade_id: 'p1', owner_id: 'u1', check_in: '2026-10-01', check_out: '2026-10-10',
  estado: 'confirmada', hospede_id: null, uid_externo: 'f::1', notas: 'Quarto indisponível',
  origem: 'outro', bloqueio_id: null,
}
const R = { propriedade_id: 'p1', check_in: '2026-10-02', check_out: '2026-10-05' }

describe('validarReservaNoBloqueio', () => {
  it('aceita uma reserva que cabe no bloqueio', () => {
    expect(validarReservaNoBloqueio(BLOQUEIO, R, 'u1')).toEqual({ ok: true })
    expect(validarReservaNoBloqueio(BLOQUEIO, { ...R, check_in: '2026-10-01', check_out: '2026-10-10' }, 'u1').ok).toBe(true)
  })

  it('recusa datas fora, outro dono, outro alojamento e bloqueio cancelado', () => {
    expect(validarReservaNoBloqueio(BLOQUEIO, { ...R, check_in: '2026-09-30' }, 'u1').ok).toBe(false)
    expect(validarReservaNoBloqueio(BLOQUEIO, R, 'u2').ok).toBe(false)
    expect(validarReservaNoBloqueio(BLOQUEIO, { ...R, propriedade_id: 'p2' }, 'u1').ok).toBe(false)
    expect(validarReservaNoBloqueio({ ...BLOQUEIO, estado: 'cancelada' }, R, 'u1').ok).toBe(false)
    expect(validarReservaNoBloqueio(null, R, 'u1').ok).toBe(false)
  })

  it('só aceita bloqueios — uma reserva normal ou uma do Booking não servem de «pai»', () => {
    expect(validarReservaNoBloqueio({ ...BLOQUEIO, hospede_id: 'g1' }, R, 'u1').ok).toBe(false)
    // O Booking não distingue: «CLOSED - Not available» já conta como reserva.
    expect(validarReservaNoBloqueio({ ...BLOQUEIO, origem: 'booking', notas: 'CLOSED - Not available' }, R, 'u1').ok).toBe(false)
    // Nem uma reserva que já está dentro de outro bloqueio.
    expect(validarReservaNoBloqueio({ ...BLOQUEIO, bloqueio_id: 'outro' }, R, 'u1').ok).toBe(false)
  })

  it('aindaDentro diz quando o Amenitiz mudou ou cancelou o período', () => {
    expect(aindaDentro(BLOQUEIO, R)).toBe(true)
    expect(aindaDentro({ ...BLOQUEIO, check_out: '2026-10-04' }, R)).toBe(false)
    expect(aindaDentro({ ...BLOQUEIO, estado: 'cancelada' }, R)).toBe(false)
    expect(aindaDentro(null, R)).toBe(false)
  })
})

describe('occupancyForMonth — noites distintas', () => {
  it('uma reserva dentro de um bloqueio não conta as noites duas vezes', () => {
    const linhas = [
      { id: 'blq', propriedade_id: 'p1', check_in: '2026-10-01', check_out: '2026-10-11', estado: 'confirmada' },
      { id: 'r', propriedade_id: 'p1', check_in: '2026-10-02', check_out: '2026-10-05', estado: 'confirmada', bloqueio_id: 'blq' },
    ] as Booking[]
    expect(occupancyForMonth(linhas, 'p1', 2026, 9).occupied).toBe(10)
  })

  it('continua a cortar nas fronteiras do mês', () => {
    const linhas = [{ id: 'a', propriedade_id: 'p1', check_in: '2026-09-28', check_out: '2026-10-03', estado: 'confirmada' }] as Booking[]
    expect(occupancyForMonth(linhas, 'p1', 2026, 9).occupied).toBe(2)
    expect(occupancyForMonth(linhas, 'p1', 2026, 8).occupied).toBe(3)
  })
})
