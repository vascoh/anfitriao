import { describe, it, expect } from 'vitest'
import {
  canaisEmRisco, agruparPorAnfitriao, resumoParaPush,
  leitoresParados, agruparParadosPorAnfitriao, resumoParadosParaPush,
} from './canais-alertas'
import type { IcalFeed } from './types'

const AGORA = new Date('2026-09-10T12:00:00Z')

function feed(over: Partial<IcalFeed> = {}): IcalFeed {
  return {
    id: 'f1',
    url: 'https://amenitiz.com/ical/abc',
    nome: 'Amenitiz',
    source: 'outro',
    last_sync: '2026-09-10T11:45:00Z',
    ...over,
  }
}

function alojamento(nome: string, feeds: IcalFeed[], over: Record<string, unknown> = {}) {
  return { nome, owner_id: 'user_1', ativo: true, ical_feeds: feeds, ...over }
}

describe('canaisEmRisco', () => {
  it('um feed lido na última passagem não é aviso nenhum', () => {
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

  it('mais de 6 horas sem leitura com sucesso é um aviso', () => {
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
      alojamento('A', [feed({ id: 'f3', error: 'Upstream devolveu 404' })]),
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
    const riscos = canaisEmRisco([alojamento('Quarto', [feed({ error: 'Upstream devolveu 404' })])], AGORA)
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

describe('canaisEmRisco — falhas passageiras', () => {
  /* Produção, 2026-11: o Amenitiz devolveu 429 quatro vezes numa semana e a
   * passagem seguinte leu sempre bem. Um 429 às 05:50 não pode virar push. */
  it('um 429 logo a seguir a uma leitura boa não gera aviso', () => {
    const r = canaisEmRisco([alojamento('Quarto', [feed({ error: 'Upstream devolveu 429' })])], AGORA)
    expect(r).toEqual([])
  })
})

describe('leitoresParados', () => {
  const agora = new Date('2026-11-24T18:00:00Z')
  const alojamentos = [
    { id: 'q1', nome: 'Quarto de Casal', owner_id: 'u1', ativo: true },
    { id: 'q2', nome: 'Quarto Familiar', owner_id: 'u1', ativo: false },
  ]
  const l = (propriedade_id: string, leitor: 'airbnb' | 'booking' | 'google' | 'amenitiz', ultima_leitura: string, origem: 'todas' | 'diretas' = 'todas') =>
    ({ propriedade_id, leitor, origem, ultima_leitura })

  it('avisa quando uma plataforma deixou de ler há mais de um dia', () => {
    const r = leitoresParados(alojamentos, [l('q1', 'airbnb', '2026-11-22T10:00:00Z')], agora)
    expect(r).toHaveLength(1)
    expect(r[0].onde).toBe('Quarto de Casal · Airbnb')
    expect(r[0].porque).toContain('há 2 dias')
  })

  it('não avisa de leituras recentes, de calendários pessoais nem de alojamentos desativados', () => {
    expect(leitoresParados(alojamentos, [
      l('q1', 'booking', '2026-11-24T12:00:00Z'),
      l('q1', 'google', '2026-11-20T12:00:00Z'),
      l('q2', 'airbnb', '2026-11-20T12:00:00Z'),
    ], agora)).toEqual([])
  })

  it('conta a leitura mais recente de qualquer dos dois feeds', () => {
    expect(leitoresParados(alojamentos, [
      l('q1', 'amenitiz', '2026-11-20T12:00:00Z', 'todas'),
      l('q1', 'amenitiz', '2026-11-24T17:00:00Z', 'diretas'),
    ], agora)).toEqual([])
  })

  it('cala-se ao fim de uma semana: já foi avisado, e o anúncio pode ter sido desligado de propósito', () => {
    expect(leitoresParados(alojamentos, [l('q1', 'airbnb', '2026-11-10T12:00:00Z')], agora)).toEqual([])
  })

  it('agrupa por anfitrião e resume para o telemóvel', () => {
    const r = leitoresParados(alojamentos, [l('q1', 'airbnb', '2026-11-22T10:00:00Z'), l('q1', 'booking', '2026-11-22T10:00:00Z')], agora)
    expect(agruparParadosPorAnfitriao(r).get('u1')).toHaveLength(2)
    expect(resumoParadosParaPush(r).body).toContain('2 calendários')
  })
})
