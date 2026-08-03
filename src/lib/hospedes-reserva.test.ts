import { describe, it, expect } from 'vitest'
import {
  faltamAoHospede, estadoDosBoletins, ordenarHospedes, vaiSerGuardado,
  type HospedeDaReserva,
} from './hospedes-reserva'
import type { Guest } from './types'

const CI = '2026-08-10'
const CO = '2026-08-14'

function hospede(nome: string, extra?: Partial<Guest>): Guest {
  return {
    id: nome.toLowerCase().replace(/\s/g, '-'),
    nome,
    data_nascimento: '1985-03-14',
    nacionalidade: 'Portugal',
    numero_documento: 'CC12345678',
    tipo_documento: 'Cartão de Cidadão',
    pais_emissao: 'Portugal',
    pais_residencia: 'Portugal',
    tags: [],
    criado_em: '2026-01-01',
    ...extra,
  }
}

function ligado(g: Guest, principal = false): HospedeDaReserva {
  return { guest: g, principal }
}

describe('faltamAoHospede', () => {
  it('uma ficha completa não tem nada em falta', () => {
    expect(faltamAoHospede(hospede('Maria Silva'), CI, CO)).toEqual([])
  })

  it('acusa o documento em falta', () => {
    const faltam = faltamAoHospede(hospede('Maria Silva', { numero_documento: undefined }), CI, CO)
    expect(faltam).toContain('número do documento')
  })

  it('acusa o país de residência, que o SIBA exige e a app não recolhia', () => {
    const faltam = faltamAoHospede(hospede('Maria Silva', { pais_residencia: undefined }), CI, CO)
    expect(faltam).toContain('país de residência')
  })

  it('não adivinha uma nacionalidade que não conhece', () => {
    const faltam = faltamAoHospede(
      hospede('John Doe', { nacionalidade: 'Nárnia', pais_emissao: undefined }),
      CI, CO,
    )
    expect(faltam).toContain('nacionalidade')
  })
})

describe('estadoDosBoletins', () => {
  it('uma reserva de 8 com um hóspede tem 7 por registar', () => {
    // O buraco que isto fecha: até aqui a reserva dava-se por tratada com a
    // ficha de quem reservou, e ficavam 7 boletins por comunicar.
    const e = estadoDosBoletins(8, [ligado(hospede('Maria Silva'), true)], CI, CO)
    expect(e.esperados).toBe(8)
    expect(e.registados).toBe(1)
    expect(e.porRegistar).toBe(7)
    expect(e.completo).toBe(false)
  })

  it('com as 8 fichas completas, a reserva está pronta', () => {
    const oito = Array.from({ length: 8 }, (_, i) => ligado(hospede(`Pessoa ${i}`), i === 0))
    const e = estadoDosBoletins(8, oito, CI, CO)
    expect(e.prontos).toBe(8)
    expect(e.porRegistar).toBe(0)
    expect(e.completo).toBe(true)
  })

  it('separa quem falta registar de quem está registado mas incompleto', () => {
    const e = estadoDosBoletins(3, [
      ligado(hospede('Maria Silva'), true),
      ligado(hospede('João Costa', { numero_documento: undefined })),
    ], CI, CO)

    expect(e.porRegistar).toBe(1)
    expect(e.prontos).toBe(1)
    expect(e.incompletos).toHaveLength(1)
    expect(e.incompletos[0].guest.nome).toBe('João Costa')
    expect(e.incompletos[0].faltam).toContain('número do documento')
    expect(e.completo).toBe(false)
  })

  it('mais fichas do que pessoas declaradas não esconde ninguém', () => {
    // Se alguém registou 3 pessoas numa reserva marcada para 2, o que conta
    // são as 3 — são 3 boletins a entregar.
    const e = estadoDosBoletins(2, [
      ligado(hospede('A'), true), ligado(hospede('B')), ligado(hospede('C')),
    ], CI, CO)
    expect(e.esperados).toBe(3)
    expect(e.porRegistar).toBe(0)
    expect(e.completo).toBe(true)
  })

  it('uma reserva sem hóspede nenhum não está completa', () => {
    const e = estadoDosBoletins(2, [], CI, CO)
    expect(e.registados).toBe(0)
    expect(e.porRegistar).toBe(2)
    expect(e.completo).toBe(false)
  })
})

describe('ordenarHospedes', () => {
  it('quem reservou aparece primeiro', () => {
    const lista = ordenarHospedes([
      ligado(hospede('Ana Lopes')),
      ligado(hospede('Zé Silva'), true),
    ])
    expect(lista[0].guest.nome).toBe('Zé Silva')
  })

  it('os restantes ficam por ordem alfabética', () => {
    const lista = ordenarHospedes([
      ligado(hospede('Carla')), ligado(hospede('Ana')), ligado(hospede('Bruno')),
    ])
    expect(lista.map(h => h.guest.nome)).toEqual(['Ana', 'Bruno', 'Carla'])
  })
})

describe('vaiSerGuardado', () => {
  it('não guarda uma linha em branco', () => {
    expect(vaiSerGuardado({ nome: '' })).toBe(false)
    expect(vaiSerGuardado({ nome: '   ' })).toBe(false)
    expect(vaiSerGuardado({ nome: null })).toBe(false)
  })

  it('guarda quem tem nome', () => {
    expect(vaiSerGuardado({ nome: 'Ana' })).toBe(true)
  })
})
