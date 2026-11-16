import { describe, it, expect } from 'vitest'
import { validarReservaNoBloqueio, aindaDentro, entradasPorIdentificar, type BloqueioParaValidar } from './reserva-no-bloqueio'
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

describe('entradasPorIdentificar', () => {
  type Linha = Parameters<typeof entradasPorIdentificar>[0][number]
  const base: Omit<Linha, 'id' | 'check_in' | 'check_out'> = {
    hospede_id: null, uid_externo: 'f::1', notas: 'Quarto indisponível', origem: 'outro',
    estado: 'confirmada', bloqueio_id: null,
  }
  const hoje = '2026-11-16'
  const limite = '2026-11-23'
  const b = (id: string, check_in: string, check_out: string, extra: Partial<Linha> = {}): Linha =>
    ({ ...base, id, check_in, check_out, ...extra })

  it('mostra os bloqueios importados que começam hoje ou na semana, por ordem', () => {
    const r = entradasPorIdentificar([b('c', '2026-11-19', '2026-11-22'), b('a', '2026-11-16', '2026-11-18')], hoje, limite)
    expect(r.map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('inclui um bloqueio já começado que ainda não acabou', () => {
    expect(entradasPorIdentificar([b('a', '2026-11-14', '2026-11-17')], hoje, limite)).toHaveLength(1)
    expect(entradasPorIdentificar([b('a', '2026-11-14', '2026-11-16')], hoje, limite)).toHaveLength(0)
  })

  it('deixa de fora o que fica para depois, o cancelado e o fecho feito à mão', () => {
    expect(entradasPorIdentificar([
      b('longe', '2026-11-24', '2026-11-26'),
      b('cancelado', '2026-11-17', '2026-11-18', { estado: 'cancelada' }),
      b('manual', '2026-11-17', '2026-11-18', { uid_externo: undefined }),
    ], hoje, limite)).toEqual([])
  })

  it('deixa de fora reservas com hóspede e bloqueios que já têm a reserva registada', () => {
    const reserva = b('r', '2026-11-16', '2026-11-18', { hospede_id: 'g1', bloqueio_id: 'a', uid_externo: undefined })
    expect(entradasPorIdentificar([b('a', '2026-11-16', '2026-11-18'), reserva], hoje, limite)).toEqual([])
    const cancelada: Linha = { ...reserva, estado: 'cancelada' }
    expect(entradasPorIdentificar([b('a', '2026-11-16', '2026-11-18'), cancelada], hoje, limite).map((x) => x.id)).toEqual(['a'])
  })

  it('não conta como bloqueio uma reserva do Airbnb (texto «Reserved»)', () => {
    expect(entradasPorIdentificar([b('x', '2026-11-17', '2026-11-19', { notas: 'Reserved', origem: 'airbnb' })], hoje, limite)).toEqual([])
  })
})
