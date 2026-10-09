import { describe, it, expect } from 'vitest'
import { EXEMPLOS, preencherModelo, validarResposta, variaveisDesconhecidas } from './respostas-guardadas'

describe('preencherModelo', () => {
  it('substitui as variáveis conhecidas', () => {
    expect(preencherModelo('Olá {primeiro_nome}, até {checkin}!', { primeiro_nome: 'Maria', checkin: '10 out.' }))
      .toBe('Olá Maria, até 10 out.!')
  })

  it('uma variável sem valor vira [confirmar], para o envio ficar bloqueado', () => {
    /* Apagá-la mandava ao hóspede «o check-in é a » sem ninguém reparar. */
    expect(preencherModelo('Check-in: {link_checkin}', {})).toBe('Check-in: [confirmar: link do check-in online]')
    expect(preencherModelo('{instrucoes_checkin}', { instrucoes_checkin: '   ' })).toBe('[confirmar: instruções de chegada]')
  })

  it('deixa intacto o que não é variável', () => {
    expect(preencherModelo('código {1234} e {xpto}', {})).toBe('código {1234} e {xpto}')
  })

  it('nomes do protótipo não passam por variáveis', () => {
    expect(preencherModelo('{constructor}', {})).toBe('{constructor}')
    expect(variaveisDesconhecidas('{constructor} {tostring}')).toEqual(['constructor', 'tostring'])
  })
})

describe('validarResposta', () => {
  it('aceita e apara', () => {
    expect(validarResposta('  Wifi ', ' A rede é X ')).toEqual({ titulo: 'Wifi', corpo: 'A rede é X' })
  })

  it('recusa vazios e excessos', () => {
    expect(validarResposta('', 'x')).toHaveProperty('erro')
    expect(validarResposta('x', '  ')).toHaveProperty('erro')
    expect(validarResposta('x'.repeat(81), 'x')).toHaveProperty('erro')
    expect(validarResposta('x', 'x'.repeat(5001))).toHaveProperty('erro')
    expect(validarResposta(1, null)).toHaveProperty('erro')
  })

  it('recusa variáveis mal escritas — ficavam literais na mensagem ao hóspede', () => {
    const r = validarResposta('Chegada', 'Olá {nomee}')
    expect(r).toEqual({ erro: 'Variável desconhecida: {nomee}.' })
  })
})

describe('EXEMPLOS', () => {
  it('só usam variáveis que existem', () => {
    for (const e of EXEMPLOS) {
      expect(variaveisDesconhecidas(e.corpo)).toEqual([])
      expect(validarResposta(e.titulo, e.corpo)).not.toHaveProperty('erro')
    }
  })
})
