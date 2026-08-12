import { describe, it, expect } from 'vitest'
import { envioPorGrupo, renderAutomationMessage, TRIGGER_DATE } from './automations'

function reserva(id: string, grupo?: string) {
  return { id, reserva_grupo_id: grupo ?? null }
}

describe('envioPorGrupo', () => {
  it('uma casa inteira dá uma mensagem, não uma por quarto', () => {
    /* Três reservas do mesmo grupo são o mesmo hóspede nas mesmas datas. O
     * motor é anterior aos grupos e mandava-lhe o mesmo "check-in amanhã"
     * três vezes na mesma manhã. */
    const envios = envioPorGrupo([
      reserva('b1', 'g1'),
      reserva('b2', 'g1'),
      reserva('b3', 'g1'),
    ])

    expect(envios).toHaveLength(1)
    expect(envios[0].cobertas.map(b => b.id)).toEqual(['b2', 'b3'])
  })

  it('as irmãs ficam registadas, senão amanhã pareciam por enviar', () => {
    const [envio] = envioPorGrupo([reserva('b2', 'g1'), reserva('b1', 'g1')])
    const todas = [envio.principal, ...envio.cobertas].map(b => b.id)
    expect(todas.sort()).toEqual(['b1', 'b2'])
  })

  it('a escolha não depende da ordem que a base devolveu', () => {
    const a = envioPorGrupo([reserva('b3', 'g1'), reserva('b1', 'g1'), reserva('b2', 'g1')])
    const b = envioPorGrupo([reserva('b1', 'g1'), reserva('b2', 'g1'), reserva('b3', 'g1')])
    expect(a[0].principal.id).toBe(b[0].principal.id)
  })

  it('reservas soltas continuam uma a uma', () => {
    const envios = envioPorGrupo([reserva('b1'), reserva('b2')])
    expect(envios).toHaveLength(2)
    expect(envios.every(e => e.cobertas.length === 0)).toBe(true)
  })

  it('não mistura grupos diferentes nem grupos com soltas', () => {
    const envios = envioPorGrupo([
      reserva('b1', 'g1'), reserva('b2', 'g1'),
      reserva('b3', 'g2'),
      reserva('b4'),
    ])
    expect(envios).toHaveLength(3)
  })

  it('lista vazia não gera envios', () => {
    expect(envioPorGrupo([])).toEqual([])
  })
})

describe('renderAutomationMessage', () => {
  it('substitui as variáveis conhecidas', () => {
    expect(renderAutomationMessage('Olá {nome}, bem-vindo a {propriedade}!', {
      nome: 'Maria', propriedade: 'Casa de Vasco',
    })).toBe('Olá Maria, bem-vindo a Casa de Vasco!')
  })

  it('uma variável desconhecida sai vazia em vez de aparecer ao hóspede', () => {
    expect(renderAutomationMessage('Olá {inexistente}.', { nome: 'Maria' })).toBe('Olá .')
  })
})

describe('TRIGGER_DATE', () => {
  it('cada gatilho olha para a coluna e o desvio certos', () => {
    expect(TRIGGER_DATE.checkin_amanha).toEqual({ coluna: 'check_in', offsetDias: 1 })
    expect(TRIGGER_DATE.checkout_hoje).toEqual({ coluna: 'check_out', offsetDias: 0 })
    expect(TRIGGER_DATE.pedir_avaliacao).toEqual({ coluna: 'check_out', offsetDias: -1 })
  })
})
