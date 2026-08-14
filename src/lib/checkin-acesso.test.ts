import { describe, it, expect } from 'vitest'
import { janelaDeCheckin } from './checkin-acesso'
import { today, addDays } from './utils'

const HOJE = today()

describe('janelaDeCheckin', () => {
  it('está aberta antes da chegada — é para isso que serve', () => {
    const r = janelaDeCheckin({ jaSubmetido: false, checkOut: addDays(HOJE, 5), hoje: HOJE })
    expect(r).toEqual({ mostraDados: true, motivo: 'aberto' })
  })

  it('fecha depois do check-in submetido', () => {
    /* O link fica na caixa de correio de quem o recebeu, para sempre. Depois
     * de submetido não há nada para preencher, e a página só mostra
     * "check-in já submetido" — mas continuava a receber a ficha completa. */
    const r = janelaDeCheckin({ jaSubmetido: true, checkOut: addDays(HOJE, 5), hoje: HOJE })
    expect(r.mostraDados).toBe(false)
    expect(r.motivo).toBe('ja_submetido')
  })

  it('fecha quando a estadia acabou', () => {
    const r = janelaDeCheckin({ jaSubmetido: false, checkOut: addDays(HOJE, -1), hoje: HOJE })
    expect(r.mostraDados).toBe(false)
    expect(r.motivo).toBe('estadia_terminada')
  })

  it('o dia do check-out ainda conta', () => {
    // Pode estar a sair nesse dia e a acabar de preencher o que faltava.
    const r = janelaDeCheckin({ jaSubmetido: false, checkOut: HOJE, hoje: HOJE })
    expect(r.mostraDados).toBe(true)
  })

  it('uma reserva sem data de saída não fecha por causa disso', () => {
    const r = janelaDeCheckin({ jaSubmetido: false, checkOut: null, hoje: HOJE })
    expect(r.mostraDados).toBe(true)
  })

  it('submetido manda mais do que a data', () => {
    const r = janelaDeCheckin({ jaSubmetido: true, checkOut: addDays(HOJE, -30), hoje: HOJE })
    expect(r.motivo).toBe('ja_submetido')
  })
})
