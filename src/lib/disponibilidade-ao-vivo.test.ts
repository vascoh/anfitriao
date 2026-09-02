import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/** URL → o que o feed devolve, ou um erro para simular uma leitura falhada. */
let feeds: Record<string, string | Error> = {}
const lidos: string[] = []

vi.mock('./ical-fetch', () => ({
  fetchIcalText: async (url: string) => {
    lidos.push(url)
    const r = feeds[url]
    if (r instanceof Error) throw r
    if (r === undefined) throw new Error('feed não configurado no teste')
    return r
  },
}))

const { verificarDisponibilidadeAoVivo, mensagemAoVivo } = await import('./disponibilidade-ao-vivo')

function calendario(...eventos: Array<{ uid: string; de: string; ate: string }>): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...eventos.flatMap(e => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTART;VALUE=DATE:${e.de.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${e.ate.replace(/-/g, '')}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n')
}

function alojamento(nome: string, ...urls: string[]) {
  return {
    nome,
    ical_feeds: urls.map((url, i) => ({
      id: `f${i}`, url, nome: `Feed ${i}`, source: 'airbnb' as const,
    })),
  }
}

beforeEach(() => {
  feeds = {}
  lidos.length = 0
})

describe('verificarDisponibilidadeAoVivo', () => {
  it('sem feeds configurados não há nada a perguntar', async () => {
    const r = await verificarDisponibilidadeAoVivo(
      [{ nome: 'Quarto', ical_feeds: [] }, { nome: 'Outro', ical_feeds: null }],
      '2026-10-01', '2026-10-03',
    )
    expect(r.livre).toBe(true)
    expect(lidos).toHaveLength(0)
  })

  it('livre quando o feed não tem nada nessas datas', async () => {
    feeds['https://a'] = calendario({ uid: '1', de: '2026-11-01', ate: '2026-11-05' })
    const r = await verificarDisponibilidadeAoVivo([alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03')
    expect(r.livre).toBe(true)
  })

  it('ocupado quando a plataforma já vendeu a noite', async () => {
    /* É este o caso que a base de dados não sabe: a reserva entrou no Airbnb
     * depois da sincronização das 04:00. */
    feeds['https://a'] = calendario({ uid: '1', de: '2026-10-02', ate: '2026-10-06' })
    const r = await verificarDisponibilidadeAoVivo([alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03')

    expect(r.livre).toBe(false)
    expect(r).toMatchObject({ motivo: 'ocupado', feed: 'Quarto · Feed 0' })
  })

  it('sair no dia em que outro entra não é conflito', async () => {
    feeds['https://a'] = calendario({ uid: '1', de: '2026-10-03', ate: '2026-10-06' })
    const r = await verificarDisponibilidadeAoVivo([alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03')
    expect(r.livre).toBe(true)
  })

  it('uma leitura falhada não é "livre"', async () => {
    /* Fechar por omissão: perder uma reserva é reversível e aparece em
     * /canais; uma dupla reserva é uma pessoa sem casa. */
    feeds['https://a'] = new Error('timeout')
    const r = await verificarDisponibilidadeAoVivo([alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03')

    expect(r.livre).toBe(false)
    expect(r).toMatchObject({ motivo: 'indisponivel', detalhe: 'timeout' })
  })

  it('uma ocupação encontrada vale mais do que uma leitura falhada', async () => {
    // Se um feed já disse que está vendido, a resposta é essa — e não
    // "não se conseguiu saber", que manda o hóspede tentar outra vez.
    feeds['https://a'] = new Error('timeout')
    feeds['https://b'] = calendario({ uid: '1', de: '2026-10-01', ate: '2026-10-04' })

    const r = await verificarDisponibilidadeAoVivo(
      [alojamento('Quarto', 'https://a', 'https://b')], '2026-10-01', '2026-10-03',
    )
    expect(r).toMatchObject({ livre: false, motivo: 'ocupado' })
  })

  it('vê os feeds de todos os quartos de uma casa inteira', async () => {
    feeds['https://q1'] = calendario()
    feeds['https://q2'] = calendario({ uid: '1', de: '2026-10-02', ate: '2026-10-04' })

    const r = await verificarDisponibilidadeAoVivo(
      [alojamento('Quarto Individual', 'https://q1'), alojamento('Quarto de Casal', 'https://q2')],
      '2026-10-01', '2026-10-03',
    )

    expect(r).toMatchObject({ livre: false, motivo: 'ocupado', feed: 'Quarto de Casal · Feed 0' })
    expect(lidos).toHaveLength(2)
  })

  it('lê os feeds em paralelo', async () => {
    // Em série, três quartos custavam três vezes o tempo — e há um hóspede à
    // espera do outro lado.
    feeds['https://q1'] = calendario()
    feeds['https://q2'] = calendario()
    feeds['https://q3'] = calendario()

    const inicio = Date.now()
    await verificarDisponibilidadeAoVivo(
      [alojamento('A', 'https://q1'), alojamento('B', 'https://q2'), alojamento('C', 'https://q3')],
      '2026-10-01', '2026-10-03',
    )
    expect(Date.now() - inicio).toBeLessThan(500)
    expect(lidos).toHaveLength(3)
  })

  it('a reserva que está a ser editada não choca consigo própria', async () => {
    /* Editar uma reserva importada era impossível: o evento que o feed
     * devolve é essa mesma reserva. Corrigir-lhe o preço — que o iCal não
     * transporta e de que o financeiro precisa — dava «datas ocupadas», com
     * uma mensagem a dizer que a reserva tinha entrado depois da última
     * sincronização. Era ela própria. */
    feeds['https://a'] = calendario({ uid: 'reserva-do-airbnb', de: '2026-10-01', ate: '2026-10-04' })

    const semIgnorar = await verificarDisponibilidadeAoVivo(
      [alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03',
    )
    expect(semIgnorar.livre).toBe(false)

    const aEditar = await verificarDisponibilidadeAoVivo(
      [alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03',
      { ignorarUid: 'reserva-do-airbnb' },
    )
    expect(aEditar.livre).toBe(true)
  })

  it('ignorar a própria não abre a porta às outras', async () => {
    // Mudar as datas de uma reserva importada para cima de outra continua a
    // ser recusado — é o caso que a verificação existe para apanhar.
    feeds['https://a'] = calendario(
      { uid: 'a-que-edito', de: '2026-10-01', ate: '2026-10-04' },
      { uid: 'outra', de: '2026-11-01', ate: '2026-11-05' },
    )

    const r = await verificarDisponibilidadeAoVivo(
      [alojamento('Quarto', 'https://a')], '2026-11-02', '2026-11-04',
      { ignorarUid: 'a-que-edito' },
    )
    expect(r).toMatchObject({ livre: false, motivo: 'ocupado' })
  })

  it('um evento com datas inválidas não bloqueia nada', async () => {
    feeds['https://a'] = [
      'BEGIN:VEVENT', 'UID:mau',
      'DTSTART;VALUE=DATE:20261005', 'DTEND;VALUE=DATE:20261001',
      'END:VEVENT',
    ].join('\r\n')

    const r = await verificarDisponibilidadeAoVivo([alojamento('Quarto', 'https://a')], '2026-10-01', '2026-10-03')
    expect(r.livre).toBe(true)
  })
})

describe('mensagemAoVivo', () => {
  it('não dá os nossos problemas a quem está do outro lado', () => {
    const msg = mensagemAoVivo({ livre: false, motivo: 'indisponivel', feed: 'Feed 0', detalhe: 'ECONNREFUSED' })
    expect(msg).not.toContain('ECONNREFUSED')
    expect(msg).not.toContain('Feed 0')
  })

  it('diz o que aconteceu quando a noite foi vendida', () => {
    expect(mensagemAoVivo({ livre: false, motivo: 'ocupado', feed: 'Feed 0' }))
      .toContain('reservadas noutra plataforma')
  })
})
