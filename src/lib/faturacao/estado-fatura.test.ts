import { describe, it, expect } from 'vitest'
import { emissaoPresa, EMISSAO_PRESA_MINUTOS } from './estado-fatura'

const AGORA = new Date('2026-08-18T12:00:00Z').getTime()
const haMinutos = (n: number) => new Date(AGORA - n * 60_000).toISOString()

describe('emissaoPresa', () => {
  it('uma emissão começada agora está a decorrer', () => {
    expect(emissaoPresa({ fatura_estado: 'a_emitir', fatura_reservada_em: haMinutos(1) }, AGORA)).toBe(false)
  })

  it('passados quinze minutos já não está a decorrer — está parada', () => {
    /* Nada libertava o estado `a_emitir`: se o processo morresse entre reservar
     * e guardar o resultado, o botão respondia "aguarda" durante meses e a
     * página mostrava uma roda a girar que nunca parava. */
    expect(emissaoPresa(
      { fatura_estado: 'a_emitir', fatura_reservada_em: haMinutos(EMISSAO_PRESA_MINUTOS + 1) },
      AGORA,
    )).toBe(true)
  })

  it('sem hora de reserva conta como parada', () => {
    // Emissões anteriores à coluna: ninguém está em `a_emitir` desde o último
    // deploy, e tratá-las como em curso era deixá-las presas para sempre.
    expect(emissaoPresa({ fatura_estado: 'a_emitir' }, AGORA)).toBe(true)
  })

  it('uma data ilegível também conta como parada', () => {
    expect(emissaoPresa({ fatura_estado: 'a_emitir', fatura_reservada_em: 'x' }, AGORA)).toBe(true)
  })

  it('os outros estados nunca estão presos', () => {
    for (const estado of ['nao_emitida', 'emitida', 'falhou']) {
      expect(emissaoPresa({ fatura_estado: estado, fatura_reservada_em: haMinutos(600) }, AGORA)).toBe(false)
    }
  })
})
