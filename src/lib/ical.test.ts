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
  it('parses Airbnb-style DATE events', () => {
    const events = parseIcal(AIRBNB_SAMPLE)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      uid: 'abc123@airbnb.com',
      summary: 'Reserved',
      start: '2026-08-10',
      end: '2026-08-15',
    })
  })

  it('parses DTSTART with UTC datetime values', () => {
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
    expect(events[0].start).toBe('2026-08-10')
    expect(events[0].end).toBe('2026-08-12')
  })

  it('accepts LF, CRLF and CR line endings', () => {
    const lf = parseIcal(AIRBNB_SAMPLE.replace(/\r\n/g, '\n'))
    const cr = parseIcal(AIRBNB_SAMPLE.replace(/\r\n/g, '\r'))
    expect(lf).toHaveLength(2)
    expect(cr).toHaveLength(2)
  })

  it('drops events with missing or inverted dates', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:no-end',
      'DTSTART;VALUE=DATE:20260810',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:inverted',
      'DTSTART;VALUE=DATE:20260815',
      'DTEND;VALUE=DATE:20260810',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:zero-nights',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260810',
      'END:VEVENT',
    ].join('\n')
    expect(parseIcal(text)).toHaveLength(0)
  })

  it('generates a uid when missing', () => {
    const text = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260810',
      'DTEND;VALUE=DATE:20260812',
      'END:VEVENT',
    ].join('\n')
    const events = parseIcal(text)
    expect(events).toHaveLength(1)
    expect(events[0].uid.length).toBeGreaterThan(0)
  })

  it('ignores properties outside VEVENT blocks', () => {
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

  it('returns empty for empty or garbage input', () => {
    expect(parseIcal('')).toHaveLength(0)
    expect(parseIcal('not an ical file')).toHaveLength(0)
  })
})

describe('generateIcal', () => {
  it('produces a calendar parseable by parseIcal (roundtrip)', () => {
    const input = [
      { uid: 'b-1', summary: 'Reserva João', start: '2026-08-10', end: '2026-08-15' },
      { uid: 'b-2', summary: 'Reserva Maria', start: '2026-09-01', end: '2026-09-03' },
    ]
    const text = generateIcal(input)
    expect(text.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(text.endsWith('END:VCALENDAR')).toBe(true)
    expect(parseIcal(text)).toEqual(input)
  })

  it('uses CRLF line endings per RFC 5545', () => {
    const text = generateIcal([{ uid: 'x', summary: 's', start: '2026-01-01', end: '2026-01-02' }])
    expect(text).toContain('\r\n')
    expect(text.replace(/\r\n/g, '').includes('\n')).toBe(false)
  })

  it('includes the calendar name', () => {
    const text = generateIcal([], 'Casa do Mar')
    expect(text).toContain('X-WR-CALNAME:Casa do Mar')
  })
})
