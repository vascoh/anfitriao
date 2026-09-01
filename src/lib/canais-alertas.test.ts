import { describe, it, expect } from 'vitest'
import { canaisEmRisco, agruparPorAnfitriao, resumoParaPush } from './canais-alertas'
import type { IcalFeed } from './types'

const AGORA = new Date('2026-09-10T12:00:00Z')

function feed(over: Partial<IcalFeed> = {}): IcalFeed {
  return {
    id: 'f1',
    url: 'https://amenitiz.com/ical/abc',
    nome: 'Amenitiz',
    source: 'outro',
    last_sync: '2026-09-10T04:00:00Z',
    ...over,
  }
}

function alojamento(nome: string, feeds: IcalFeed[], over: Record<string, unknown> = {}) {
  return { nome, owner_id: 'user_1', ativo: true, ical_feeds: feeds, ...over }
}

describe('canaisEmRisco', () => {
  it('um feed que sincronizou esta madrugada não é aviso nenhum', () => {
    expect(canaisEmRisco([alojamento('Quarto', [feed()])], AGORA)).toEqual([])
  })

  it('um feed em erro é um aviso, com a causa traduzida', () => {
    const r = canaisEmRisco([alojamento('Quarto', [feed({ error: 'Upstream devolveu 404' })])], AGORA)

    expect(r).toHaveLength(1)
    expect(r[0].onde).toBe('Quarto · Amenitiz')
    expect(r[0].estado).toBe('erro')
    // A mensagem crua não serve a quem não escreveu o código.
    expect(r[0].porque).not.toContain('Upstream')
    expect(r[0].porque).toContain('endereço')
  })

  it('mais de 36 horas sem leitura com sucesso é um aviso', () => {
    const r = canaisEmRisco(
      [alojamento('Quarto', [feed({ last_sync: '2026-09-08T04:00:00Z' })])],
      AGORA,
    )
    expect(r[0].estado).toBe('desatualizado')
  })

  it('um feed acabado de ligar não é aviso — ainda não teve hipótese', () => {
    const r = canaisEmRisco([alojamento('Quarto', [feed({ last_sync: undefined })])], AGORA)
    expect(r).toEqual([])
  })

  it('não avisa sobre alojamentos desativados nem sobre os que não têm dono', () => {
    // Um alojamento desativado não recusa reserva nenhuma; um sem dono não tem
    // a quem avisar.
    const r = canaisEmRisco([
      alojamento('Desativado', [feed({ error: 'x' })], { ativo: false }),
      alojamento('Sem dono', [feed({ error: 'x' })], { owner_id: null }),
    ], AGORA)

    expect(r).toEqual([])
  })

  it('o erro vem antes do desatualizado — quem lê um aviso lê a primeira linha', () => {
    const r = canaisEmRisco([
      alojamento('B', [feed({ id: 'f2', last_sync: '2026-09-08T04:00:00Z' })]),
      alojamento('A', [feed({ id: 'f3', error: 'timeout' })]),
    ], AGORA)

    expect(r.map(x => x.estado)).toEqual(['erro', 'desatualizado'])
  })

  it('aguenta um alojamento sem feeds', () => {
    expect(canaisEmRisco([alojamento('Casa', [])], AGORA)).toEqual([])
    expect(canaisEmRisco([{ nome: 'Casa', owner_id: 'u', ical_feeds: null }], AGORA)).toEqual([])
  })
})

describe('agruparPorAnfitriao', () => {
  it('um aviso por pessoa, nunca um por calendário', () => {
    const riscos = canaisEmRisco([
      alojamento('Quarto 1', [feed({ error: 'a' })]),
      alojamento('Quarto 2', [feed({ error: 'b' })]),
      alojamento('Do outro', [feed({ error: 'c' })], { owner_id: 'user_2' }),
    ], AGORA)

    const grupos = agruparPorAnfitriao(riscos)
    expect(grupos.size).toBe(2)
    expect(grupos.get('user_1')).toHaveLength(2)
  })
})

describe('resumoParaPush', () => {
  it('diz a consequência, não o estado', () => {
    /* «Um calendário com erro» não move ninguém. «Estás a recusar reservas»
     * move — e desde a verificação ao vivo é literalmente o que acontece. */
    const riscos = canaisEmRisco([alojamento('Quarto', [feed({ error: 'timeout' })])], AGORA)
    const { title, body } = resumoParaPush(riscos)

    expect(title).toContain('parou de responder')
    expect(body).toContain('recusadas')
    expect(body).toContain('Quarto · Amenitiz')
  })

  it('com vários, conta-os em vez de os listar', () => {
    const riscos = canaisEmRisco([
      alojamento('Q1', [feed({ error: 'a' })]),
      alojamento('Q2', [feed({ error: 'b' })]),
    ], AGORA)

    expect(resumoParaPush(riscos).body).toContain('2 calendários')
  })
})
