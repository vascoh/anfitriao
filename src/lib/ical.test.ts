import { describe, it, expect } from 'vitest'
import { parseIcal, generateIcal } from './ical'

const AIRBNB_SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260810',
  'DTEND;VALUE=DATE:20260815',
  'UID:abc123@airbnb.com',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260901',
  'DTEND;VALUE=DATE:20260903',
  'UID:def456@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcal', () => {
  it('lê eventos de dia inteiro, como os do Airbnb', () => {
    const events = parseIcal(AIRBNB_SAMPLE)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      uid: 'abc123@airbnb.com',
      summary: 'Reserved',
      dtstart: '2026-08-10',
      dtend: '2026-08-15',
    })
  })

  it('lê DTSTART com data e hora em UTC', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:x1',
      'SUMMARY:Booking',
      'DTSTART:20260810T140000Z',
      'DTEND:20260812T100000Z',
      'END:VEVENT',
    ].join('\n')
    const events = parseIcal(text)
    expect(events).toHaveLength(1)
    expect(events[0].dtstart).toBe('2026-08-10')
    expect(events[0].dtend).toBe('2026-08-12')
  })

  it('aceita LF, CRLF e CR', () => {
    expect(parseIcal(AIRBNB_SAMPLE.replace(/\r\n/g, '\n'))).toHaveLength(2)
    expect(parseIcal(AIRBNB_SAMPLE.replace(/\r\n/g, '\r'))).toHaveLength(2)
  })

  it('desdobra linhas partidas a meio', () => {
    /* RFC 5545 §3.1: uma linha longa é partida e a continuação vem com um
     * espaço à frente. Sem desdobrar, um UID longo entrava cortado — e um UID
     * cortado é uma reserva que a sincronização não reconhece na noite
     * seguinte, e volta a importar. */
    const text = [
      'BEGIN:VEVENT',
      'UID:reserva-muito-comprida-do-booking-com-um-identificador-que-nao',
      ' -cabe-numa-linha@booking.com',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260812',
      'END:VEVENT',
    ].join('\r\n')

    const events = parseIcal(text)
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe(
      'reserva-muito-comprida-do-booking-com-um-identificador-que-nao-cabe-numa-linha@booking.com',
    )
  })

  it('não inventa UID: um evento sem UID não é importável', () => {
    /* Um UID gerado por nós seria diferente em cada leitura, e a deduplicação
     * é pelo UID: a mesma reserva entrava de novo todas as noites. */
    const text = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260812',
      'END:VEVENT',
    ].join('\n')
    expect(parseIcal(text)).toHaveLength(0)
  })

  it('deixa cair eventos sem datas', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:no-end',
      'DTSTART;VALUE=DATE:20260810',
      'END:VEVENT',
    ].join('\n')
    expect(parseIcal(text)).toHaveLength(0)
  })

  it('ignora propriedades fora de um VEVENT', () => {
    const text = [
      'DTSTART;VALUE=DATE:20260101',
      'DTEND;VALUE=DATE:20260105',
      'BEGIN:VEVENT',
      'UID:only',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260812',
      'END:VEVENT',
    ].join('\n')
    const events = parseIcal(text)
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('only')
  })

  it('devolve vazio para entrada vazia ou lixo', () => {
    expect(parseIcal('')).toHaveLength(0)
    expect(parseIcal('not an ical file')).toHaveLength(0)
  })
})

describe('generateIcal', () => {
  it('produz um calendário que o parseIcal lê de volta', () => {
    const input = [
      { uid: 'b-1', summary: 'Reserva João', start: '2026-08-10', end: '2026-08-15' },
      { uid: 'b-2', summary: 'Reserva Maria', start: '2026-09-01', end: '2026-09-03' },
    ]
    const text = generateIcal(input)
    expect(text.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(text.endsWith('END:VCALENDAR')).toBe(true)
    expect(parseIcal(text)).toEqual(input.map(e => ({
      uid: e.uid, summary: e.summary, dtstart: e.start, dtend: e.end,
    })))
  })

  it('usa CRLF, como manda a RFC 5545', () => {
    const text = generateIcal([{ uid: 'x', summary: 's', start: '2026-01-01', end: '2026-01-02' }])
    expect(text).toContain('\r\n')
    expect(text.replace(/\r\n/g, '').includes('\n')).toBe(false)
  })

  it('inclui o nome do calendário', () => {
    const text = generateIcal([], 'Casa do Mar')
    expect(text).toContain('X-WR-CALNAME:Casa do Mar')
  })
})
