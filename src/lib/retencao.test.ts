import { describe, it, expect } from 'vitest'
import {
  avaliarRetencao,
  camposAnonimizacao,
  descreverPrazo,
  CAMPOS_BOLETIM,
  CAMPOS_CONTACTO,
  NOME_ANONIMO,
  PRAZOS,
  TODOS_OS_GRUPOS,
} from './retencao'
import { addDays } from './utils'

const HOJE = '2026-07-30'

describe('avaliarRetencao', () => {
  it('hóspede que saiu ontem não perde nada', () => {
    const { grupos } = avaliarRetencao('2026-07-29', '2026-07-01', HOJE)
    expect(grupos).toEqual([])
  })

  it('o boletim cai ao fim de 1 ano, o contacto sobrevive', () => {
    const saida = addDays(HOJE, -PRAZOS.boletim.dias)
    const { grupos } = avaliarRetencao(saida, null, HOJE)
    expect(grupos).toEqual(['boletim'])
  })

  it('no dia anterior ao prazo ainda não cai (limite inclusivo no dia certo)', () => {
    const saida = addDays(HOJE, -PRAZOS.boletim.dias + 1)
    expect(avaliarRetencao(saida, null, HOJE).grupos).toEqual([])
  })

  it('ao fim de 3 anos cai tudo', () => {
    const saida = addDays(HOJE, -PRAZOS.contacto.dias)
    expect(avaliarRetencao(saida, null, HOJE).grupos).toEqual(TODOS_OS_GRUPOS)
  })

  it('conta da última saída: um hóspede que volta reinicia o prazo', () => {
    const antiga = addDays(HOJE, -PRAZOS.contacto.dias - 100)
    // A estadia recente é a que conta, apesar de existir uma de há anos.
    expect(avaliarRetencao('2026-07-01', antiga, HOJE).grupos).toEqual([])
  })

  it('reserva futura não inicia contagem nenhuma', () => {
    const criadoHaMuito = addDays(HOJE, -PRAZOS.contacto.dias - 10)
    expect(avaliarRetencao('2026-12-24', criadoHaMuito, HOJE).grupos).toEqual([])
  })

  it('sem reservas conta-se da criação do registo', () => {
    const criado = addDays(HOJE, -PRAZOS.boletim.dias)
    expect(avaliarRetencao(null, criado, HOJE).grupos).toEqual(['boletim'])
  })

  it('sem saída e sem criação não decide nada (não inventa prazos)', () => {
    expect(avaliarRetencao(null, null, HOJE)).toEqual({ grupos: [], expiraEm: {} })
  })

  it('expõe a data de expiração de cada grupo', () => {
    const { expiraEm } = avaliarRetencao('2026-01-01', null, HOJE)
    expect(expiraEm.boletim).toBe(addDays('2026-01-01', PRAZOS.boletim.dias))
    expect(expiraEm.contacto).toBe(addDays('2026-01-01', PRAZOS.contacto.dias))
  })
})

describe('camposAnonimizacao', () => {
  it('boletim: apaga todos os campos do documento e mais nenhum', () => {
    const campos = camposAnonimizacao(['boletim'])
    for (const campo of CAMPOS_BOLETIM) expect(campos[campo]).toBeNull()
    expect(campos.nome).toBeUndefined()
    expect(campos.email).toBeUndefined()
  })

  it('contacto: apaga contactos e notas, e substitui o nome', () => {
    const campos = camposAnonimizacao(['contacto'])
    for (const campo of CAMPOS_CONTACTO) expect(campos[campo]).toBeNull()
    expect(campos.nome).toBe(NOME_ANONIMO)
    expect(campos.notas).toBeNull()
  })

  it('nunca toca em campos fiscais nem no id', () => {
    const campos = camposAnonimizacao(TODOS_OS_GRUPOS)
    for (const proibido of ['id', 'owner_id', 'criado_em', 'preco_total']) {
      expect(campos).not.toHaveProperty(proibido)
    }
  })

  it('sem grupos não escreve nada', () => {
    expect(camposAnonimizacao([])).toEqual({})
  })
})

describe('descreverPrazo', () => {
  it('usa a unidade legível', () => {
    expect(descreverPrazo(365)).toBe('1 ano')
    expect(descreverPrazo(3 * 365)).toBe('3 anos')
    expect(descreverPrazo(30)).toBe('1 mês')
    expect(descreverPrazo(90)).toBe('3 meses')
    expect(descreverPrazo(45)).toBe('45 dias')
  })
})
