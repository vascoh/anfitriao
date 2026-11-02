import { describe, it, expect } from 'vitest'
import { planearLimpezas, porConfirmar, validarMarcacao, validarAcesso, unidadesDoAcesso } from './limpezas'

let n = 0
function r(prop: string, ci: string, co: string, extra: Record<string, unknown> = {}) {
  n++
  return {
    id: `b${n}`, propriedade_id: prop, check_in: ci, check_out: co,
    estado: 'confirmada' as const, num_hospedes: 2, hospede_id: `g${n}`,
    uid_externo: undefined as string | undefined, notas: undefined as string | undefined,
    origem: 'direto' as const, ...extra,
  }
}

describe('planearLimpezas', () => {
  it('uma limpeza por saída, com quem entra a seguir', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-04'), r('q1', '2026-11-06', '2026-11-09', { num_hospedes: 3 })],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l.map(x => x.data)).toEqual(['2026-11-04', '2026-11-09'])
    expect(l[0].entrada).toEqual({ data: '2026-11-06', hospedes: 3, noites: 3 })
    expect(l[0].mesmoDia).toBe(false)
    expect(l[1].entrada).toBeNull()
  })

  it('assinala a troca no mesmo dia e põe-na primeiro', () => {
    const l = planearLimpezas({
      reservas: [
        r('q2', '2026-11-01', '2026-11-04'),
        r('q1', '2026-11-01', '2026-11-04'), r('q1', '2026-11-04', '2026-11-05'),
      ],
      de: '2026-11-01', ate: '2026-11-04',
    })
    expect(l.map(x => [x.propriedade_id, x.mesmoDia])).toEqual([['q1', true], ['q2', false]])
  })

  it('ignora canceladas, no-shows e fechos manuais', () => {
    const l = planearLimpezas({
      reservas: [
        r('q1', '2026-11-01', '2026-11-03', { estado: 'cancelada' }),
        r('q1', '2026-11-01', '2026-11-03', { estado: 'no_show' }),
        r('q1', '2026-11-05', '2026-11-07', { hospede_id: null }), // fecho manual
      ],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l).toEqual([])
  })

  it('um fecho manual não conta como próxima entrada', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-03'), r('q1', '2026-11-03', '2026-11-10', { hospede_id: null })],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l[0].mesmoDia).toBe(false)
    expect(l[0].entrada).toBeNull()
  })

  it('fecho vindo de um feed entra como incerto', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-03', { hospede_id: null, uid_externo: 'x', notas: 'Quarto indisponível', origem: 'outro' })],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l).toHaveLength(1)
    expect(l[0].incerta).toBe(true)
    expect(l[0].saida.hospedes).toBe(0)
  })

  it('reserva importada sem ficha conta como reserva', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-03', { hospede_id: null, uid_externo: 'x', notas: 'Reserved', origem: 'airbnb' })],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l[0].incerta).toBe(false)
  })

  it('reserva e fecho a sair no mesmo dia dão uma limpeza só, certa', () => {
    const l = planearLimpezas({
      reservas: [
        r('q1', '2026-11-01', '2026-11-03', { hospede_id: null, uid_externo: 'x', notas: 'Quarto indisponível', origem: 'outro' }),
        r('q1', '2026-11-02', '2026-11-03', { num_hospedes: 4 }),
      ],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l).toHaveLength(1)
    expect(l[0].incerta).toBe(false)
    expect(l[0].saida.hospedes).toBe(4)
  })

  it('não há troca numa noite que outra reserva continua a ocupar', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-10'), r('q1', '2026-11-02', '2026-11-04')],
      de: '2026-11-01', ate: '2026-11-30',
    })
    expect(l.map(x => x.data)).toEqual(['2026-11-10'])
  })

  it('respeita a janela e o filtro de quartos', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-10-01', '2026-10-03'), r('q1', '2026-11-01', '2026-11-03'), r('q2', '2026-11-01', '2026-11-03')],
      de: '2026-11-01', ate: '2026-11-30', ordemUnidades: ['q2'],
    })
    expect(l.map(x => x.chave)).toEqual(['q2:2026-11-03'])
  })

  it('aplica o que foi registado', () => {
    const l = planearLimpezas({
      reservas: [r('q1', '2026-11-01', '2026-11-03')],
      de: '2026-11-01', ate: '2026-11-30',
      registos: [{ propriedade_id: 'q1', data: '2026-11-03', estado: 'problema', nota: 'Falta toalha', por: 'Maria', atualizado_em: 'x' }],
    })
    expect(l[0]).toMatchObject({ estado: 'problema', nota: 'Falta toalha', por: 'Maria' })
  })
})

describe('porConfirmar', () => {
  it('só o que ficou por fazer em dias passados', () => {
    expect(porConfirmar({ estado: 'por_fazer', data: '2026-11-01' }, '2026-11-02')).toBe(true)
    expect(porConfirmar({ estado: 'por_fazer', data: '2026-11-02' }, '2026-11-02')).toBe(false)
    expect(porConfirmar({ estado: 'feita', data: '2026-11-01' }, '2026-11-02')).toBe(false)
  })
})

describe('validarMarcacao', () => {
  const hoje = '2026-11-02'
  it('aceita uma marcação normal', () => {
    expect(validarMarcacao({ propriedade_id: 'q1', data: '2026-11-02', estado: 'feita' }, hoje))
      .toEqual({ propriedade_id: 'q1', data: '2026-11-02', estado: 'feita', nota: null })
  })
  it('recusa marcar como feita uma limpeza distante', () => {
    expect(validarMarcacao({ propriedade_id: 'q1', data: '2026-11-20', estado: 'feita' }, hoje)).toHaveProperty('erro')
  })
  it('um problema precisa de descrição', () => {
    expect(validarMarcacao({ propriedade_id: 'q1', data: '2026-11-02', estado: 'problema', nota: '  ' }, hoje)).toHaveProperty('erro')
  })
  it('recusa estados e datas inventados', () => {
    expect(validarMarcacao({ propriedade_id: 'q1', data: '2026-11-02', estado: 'apagar' }, hoje)).toHaveProperty('erro')
    expect(validarMarcacao({ propriedade_id: 'q1', data: '02/11/2026', estado: 'feita' }, hoje)).toHaveProperty('erro')
  })
})

describe('validarAcesso e unidadesDoAcesso', () => {
  it('só aceita alojamentos do próprio anfitrião', () => {
    expect(validarAcesso({ nome: 'Maria', propriedade_ids: ['a', 'x'] }, new Set(['a']))).toHaveProperty('erro')
    expect(validarAcesso({ nome: 'Maria', propriedade_ids: ['a', 'a'] }, new Set(['a']))).toEqual({ nome: 'Maria', propriedade_ids: ['a'] })
    expect(validarAcesso({ nome: ' ', propriedade_ids: [] }, new Set())).toHaveProperty('erro')
  })
  it('uma casa inclui os quartos; vazio é tudo', () => {
    const props = [{ id: 'casa' }, { id: 'q1', parent_id: 'casa' }, { id: 'apt' }]
    expect([...unidadesDoAcesso(['casa'], props)].sort()).toEqual(['casa', 'q1'])
    expect(unidadesDoAcesso([], props).size).toBe(3)
  })
})
