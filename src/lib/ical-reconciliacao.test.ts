import { describe, it, expect } from 'vitest'
import {
  reconciliarPropriedade, uidDeOrigem, canceladaPelaSincronizacao,
  CANCELAMENTO_POR_SINCRONIZACAO, type ReservaImportada,
} from './ical-reconciliacao'
import { today, addDays } from './utils'

const FEED = 'feed-1::'
const HOJE = today()

function reserva(over: Partial<ReservaImportada> = {}): ReservaImportada {
  return {
    id: 'b1',
    uid_externo: `${FEED}abc`,
    check_in: addDays(HOJE, 10),
    check_out: addDays(HOJE, 14),
    estado: 'confirmada',
    ...over,
  }
}

/** Um bloqueio como o Amenitiz os manda: sem hóspede e com o texto do feed. */
function bloqueio(over: Partial<ReservaImportada> = {}): ReservaImportada {
  return reserva({ notas: 'Quarto indisponível', ...over })
}

const OK = { hoje: HOJE, todosOsFeedsOk: true }

describe('uidDeOrigem', () => {
  it('tira o prefixo do feed', () => {
    expect(uidDeOrigem('feed-1::abc-123')).toBe('abc-123')
  })

  it('aguenta um uid sem prefixo e um uid com dois pontos lá dentro', () => {
    expect(uidDeOrigem('abc-123')).toBe('abc-123')
    expect(uidDeOrigem('feed-1::urn:uuid:9')).toBe('urn:uuid:9')
  })
})

describe('canceladaPelaSincronizacao', () => {
  it('olha só para o cancelamento mais recente', () => {
    /* Cancelada pela sincronização, reativada, e depois cancelada à mão: a
     * decisão que conta é a última, e essa não se desfaz. */
    expect(canceladaPelaSincronizacao([
      { tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO },
      { tipo: 'sincronizacao' },
      { tipo: 'cancelada' },
    ])).toBe(false)

    expect(canceladaPelaSincronizacao([
      { tipo: 'cancelada' },
      { tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO },
    ])).toBe(true)
  })

  it('sem histórico, sem prova — não se reativa', () => {
    expect(canceladaPelaSincronizacao(undefined)).toBe(false)
    expect(canceladaPelaSincronizacao([])).toBe(false)
    expect(canceladaPelaSincronizacao('lixo')).toBe(false)
    expect(canceladaPelaSincronizacao([null, 'x'])).toBe(false)
  })
})

describe('reconciliarPropriedade', () => {
  it('uma reserva que desapareceu do feed foi cancelada na plataforma', () => {
    // Sem isto o quarto ficava bloqueado para sempre e o anfitrião recusava
    // reservas diretas para datas que já estavam livres.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva()],
      eventos: [{ uid: 'outra', dtstart: addDays(HOJE, 30), dtend: addDays(HOJE, 32) }],
      contagemAnterior: 2,
    })

    expect(r.paraCancelar.map(c => c.id)).toEqual(['b1'])
  })

  it('datas alteradas na plataforma são aplicadas cá', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva()],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 15) }],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar).toEqual([{
      id: 'b1',
      check_in: addDays(HOJE, 11),
      check_out: addDays(HOJE, 15),
      antes: `${addDays(HOJE, 10)} → ${addDays(HOJE, 14)}`,
    }])
  })

  it('datas iguais não geram escrita nenhuma', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva()],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraAtualizar).toHaveLength(0)
    expect(r.paraCancelar).toHaveLength(0)
  })

  it('o feed re-adicionado é reconhecido como o mesmo', () => {
    /* O `feed.id` muda quando se remove e volta a adicionar o calendário — os
     * guias mandam fazer isso quando o endereço muda. Comparar por feed
     * deixava as reservas antigas órfãs e reimportava tudo em duplicado. */
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ uid_externo: 'feed-ANTIGO::abc' })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 12), dtend: addDays(HOJE, 16) }],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar[0].check_in).toBe(addDays(HOJE, 12))
  })

  it('não cancela reservas que já terminaram', () => {
    // As plataformas deixam de publicar eventos antigos. Sem esta regra, o
    // histórico inteiro era cancelado na primeira sincronização.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ check_in: addDays(HOJE, -20), check_out: addDays(HOJE, -15) })],
      eventos: [],
      contagemAnterior: 0,
    })

    expect(r.paraCancelar).toHaveLength(0)
  })

  it('uma união vazia que antes tinha reservas não cancela nada', () => {
    // Uma página de erro ou uma resposta truncada parecem-se com "não há
    // reservas". Cancelar a agenda toda por causa disso é irreversível na
    // prática — o anfitrião não sabe o que lá estava.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva(), reserva({ id: 'b2', uid_externo: `${FEED}def` })],
      eventos: [],
      contagemAnterior: 2,
    })

    expect(r.paraCancelar).toHaveLength(0)
  })

  it('se um feed falhou, não se cancela nada', () => {
    /* Com dois feeds e um em baixo, as reservas do que falhou pareceriam
     * desaparecidas — e seriam canceladas por causa de dez segundos de rede. */
    const r = reconciliarPropriedade({
      hoje: HOJE,
      todosOsFeedsOk: false,
      locais: [reserva()],
      eventos: [{ uid: 'outra', dtstart: addDays(HOJE, 30), dtend: addDays(HOJE, 32) }],
      contagemAnterior: 2,
    })

    expect(r.paraCancelar).toHaveLength(0)
  })

  it('mas continua a aplicar as datas mesmo com um feed em baixo', () => {
    const r = reconciliarPropriedade({
      hoje: HOJE,
      todosOsFeedsOk: false,
      locais: [reserva()],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraAtualizar).toHaveLength(1)
  })

  it('não toca em reservas criadas à mão', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ id: 'manual', uid_externo: '' })],
      eventos: [],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar).toHaveLength(0)
  })

  it('não mexe em quem já fez check-in, nem no que já foi cancelado', () => {
    // Alguém que já está em casa não é desalojado por o feed ter tremido.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [
        reserva({ id: 'dentro', estado: 'checkin' }),
        reserva({ id: 'ja-cancelada', uid_externo: `${FEED}xyz`, estado: 'cancelada' }),
      ],
      eventos: [],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar).toHaveLength(0)
  })

  it('uma reserva a decorrer que muda de data é atualizada, não cancelada', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ check_in: addDays(HOJE, -2), check_out: addDays(HOJE, 3) })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, -2), dtend: addDays(HOJE, 5) }],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar[0].check_out).toBe(addDays(HOJE, 5))
  })

  it('um cancelamento nosso desfaz-se quando o UID volta ao feed', () => {
    /* As travas não são infalíveis: um feed que devolva 20 dos 21 eventos
     * passa por todas elas. Sem reativação, essa reserva ficava cancelada para
     * sempre — nunca era reimportada (o UID já cá estava) nem corrigida — e o
     * quarto dizia-se livre numas datas em que ia mesmo chegar alguém. */
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({
        estado: 'cancelada',
        historico: [{ tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO }],
      })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraReativar).toEqual([{
      id: 'b1',
      check_in: addDays(HOJE, 10),
      check_out: addDays(HOJE, 14),
    }])
  })

  it('reativar aplica as datas do feed, não as que a reserva tinha', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({
        estado: 'cancelada',
        historico: [{ tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO }],
      })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 16) }],
      contagemAnterior: 1,
    })

    expect(r.paraReativar[0].check_in).toBe(addDays(HOJE, 11))
    expect(r.paraReativar[0].check_out).toBe(addDays(HOJE, 16))
    expect(r.paraAtualizar).toHaveLength(0)
  })

  it('um cancelamento do anfitrião nunca é desfeito', () => {
    // A plataforma continuar a publicar o evento não contraria uma decisão de
    // quem lá está — e o anfitrião cancela cá o que já tratou por telefone.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ estado: 'cancelada', historico: [{ tipo: 'cancelada' }] })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraReativar).toHaveLength(0)
  })

  it('não reativa o que já terminou', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({
        estado: 'cancelada',
        check_in: addDays(HOJE, -20),
        check_out: addDays(HOJE, -15),
        historico: [{ tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO }],
      })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, -20), dtend: addDays(HOJE, -15) }],
      contagemAnterior: 1,
    })

    expect(r.paraReativar).toHaveLength(0)
  })

  it('reativa mesmo com um feed em baixo — voltar a ocupar é o lado seguro', () => {
    const r = reconciliarPropriedade({
      hoje: HOJE,
      todosOsFeedsOk: false,
      locais: [reserva({
        estado: 'cancelada',
        historico: [{ tipo: 'cancelada', origem: CANCELAMENTO_POR_SINCRONIZACAO }],
      })],
      eventos: [{ uid: 'abc', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraReativar).toHaveLength(1)
  })

  it('reservas de dois feeds diferentes convivem sem se cancelarem', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [
        reserva({ id: 'do-feed-1', uid_externo: 'feed-1::aaa' }),
        reserva({ id: 'do-feed-2', uid_externo: 'feed-2::bbb' }),
      ],
      eventos: [
        { uid: 'aaa', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) },
        { uid: 'bbb', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) },
      ],
      contagemAnterior: 2,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar).toHaveLength(0)
  })
})

describe('quando a plataforma muda o UID sozinha', () => {
  /**
   * Medido em dados reais a 2026-09-03: os UIDs do Amenitiz são UUIDv5 — um
   * hash do conteúdo do evento. O mesmo bloqueio passou de `f199cc0d-…`
   * (02→23 set) para `ea2b6a7e-…` (03→23 set) só por a data de início ter
   * avançado um dia. O UID antigo desaparecia (cancelava-se) e o novo entrava
   * como reserva nova: uma linha cancelada por dia, para sempre.
   */
  it('reconhece o mesmo bloqueio com outro nome e atualiza-o', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [bloqueio({ uid_externo: `${FEED}f199cc0d` })],
      eventos: [{ uid: 'ea2b6a7e', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar).toHaveLength(1)
    expect(r.paraAtualizar[0]).toMatchObject({
      id: 'b1',
      check_in: addDays(HOJE, 11),
      novoUidExterno: `${FEED}ea2b6a7e`,
    })
  })

  it('o evento absorvido não volta a entrar como reserva nova', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [bloqueio({ uid_externo: `${FEED}antigo` })],
      eventos: [{ uid: 'novo', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.absorvidos.has('novo')).toBe(true)
  })

  it('não junta duas reservas de hóspedes que se pareçam', () => {
    /* Entre pessoas, «parece a mesma» não chega: juntar duas seria misturar
     * hóspedes diferentes. Cancelar e criar é feio, mas não engana ninguém. */
    const r = reconciliarPropriedade({
      ...OK,
      locais: [reserva({ uid_externo: `${FEED}antigo`, notas: 'Reserva de João' })],
      eventos: [{ uid: 'novo', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 14) }],
      contagemAnterior: 1,
    })

    expect(r.paraAtualizar).toHaveLength(0)
    expect(r.paraCancelar).toHaveLength(1)
    expect(r.absorvidos.size).toBe(0)
  })

  it('com dois candidatos possíveis não adivinha — cancela', () => {
    // Dois bloqueios novos a tocar nas mesmas datas: qual deles é o antigo?
    // Sem resposta única, mais vale o comportamento antigo do que um palpite.
    const r = reconciliarPropriedade({
      ...OK,
      locais: [bloqueio({ uid_externo: `${FEED}antigo` })],
      eventos: [
        { uid: 'novo-a', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 13) },
        { uid: 'novo-b', dtstart: addDays(HOJE, 13), dtend: addDays(HOJE, 16) },
      ],
      contagemAnterior: 1,
    })

    expect(r.paraAtualizar).toHaveLength(0)
    expect(r.paraCancelar).toHaveLength(1)
  })

  it('um bloqueio novo que não toca em nada é mesmo novo', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [bloqueio({ uid_externo: `${FEED}antigo` })],
      eventos: [
        { uid: 'antigo', dtstart: addDays(HOJE, 10), dtend: addDays(HOJE, 14) },
        { uid: 'noutro-mes', dtstart: addDays(HOJE, 60), dtend: addDays(HOJE, 64) },
      ],
      contagemAnterior: 1,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.absorvidos.size).toBe(0)
  })

  it('dois bloqueios que trocam de UID ao mesmo tempo não se cruzam', () => {
    const r = reconciliarPropriedade({
      ...OK,
      locais: [
        bloqueio({ id: 'b-jan', uid_externo: `${FEED}v1`, check_in: addDays(HOJE, 10), check_out: addDays(HOJE, 14) }),
        bloqueio({ id: 'b-fev', uid_externo: `${FEED}v2`, check_in: addDays(HOJE, 40), check_out: addDays(HOJE, 44) }),
      ],
      eventos: [
        { uid: 'w1', dtstart: addDays(HOJE, 11), dtend: addDays(HOJE, 14) },
        { uid: 'w2', dtstart: addDays(HOJE, 41), dtend: addDays(HOJE, 44) },
      ],
      contagemAnterior: 2,
    })

    expect(r.paraCancelar).toHaveLength(0)
    expect(r.paraAtualizar.map(a => a.id).sort()).toEqual(['b-fev', 'b-jan'])
    expect(r.absorvidos.size).toBe(2)
  })
})
