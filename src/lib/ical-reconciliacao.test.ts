import { describe, it, expect } from 'vitest'
import { reconciliarPropriedade, uidDeOrigem, type ReservaImportada } from './ical-reconciliacao'
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
