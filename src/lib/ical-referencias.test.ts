import { describe, it, expect } from 'vitest'
import { referenciaDoAirbnb, urlDaReservaNaPlataforma } from './ical-referencias'
import { parseIcal } from './ical'

const FEED_AIRBNB = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261210',
  'DTEND;VALUE=DATE:20261214',
  'UID:1418fb94e984-0aa6b5e4c3c0a5a2d2f1@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/d',
  ' etails/HMQ4ZK8XYW\\nPhone Number (Last 4 Digits): 1234',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261220',
  'DTEND;VALUE=DATE:20261222',
  'UID:7f3a@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('referenciaDoAirbnb', () => {
  it('tira o código do feed real, com a linha dobrada a meio do URL', () => {
    const [reserva, bloqueio] = parseIcal(FEED_AIRBNB)
    expect(referenciaDoAirbnb(reserva.description)).toBe('HMQ4ZK8XYW')
    expect(referenciaDoAirbnb(bloqueio.description)).toBeNull()
  })

  it('não guarda os dígitos do telefone', () => {
    const [reserva] = parseIcal(FEED_AIRBNB)
    expect(referenciaDoAirbnb(reserva.description)).not.toContain('1234')
  })

  it('aceita os domínios locais do Airbnb', () => {
    expect(referenciaDoAirbnb('https://www.airbnb.pt/hosting/reservations/details/HMABCDEF12')).toBe('HMABCDEF12')
    expect(referenciaDoAirbnb('https://airbnb.co.uk/hosting/reservations/details/hmabcdef12')).toBe('HMABCDEF12')
  })

  it('recusa o que não é um URL de reserva do Airbnb', () => {
    expect(referenciaDoAirbnb('')).toBeNull()
    expect(referenciaDoAirbnb(undefined)).toBeNull()
    expect(referenciaDoAirbnb('Quarto indisponível')).toBeNull()
    expect(referenciaDoAirbnb('https://evil.example/hosting/reservations/details/HMABCDEF12')).toBeNull()
    expect(referenciaDoAirbnb('https://airbnb.com.evil.example/hosting/reservations/details/HMABCDEF12')).toBeNull()
    expect(referenciaDoAirbnb('https://www.airbnb.com/hosting/reservations/details/12345')).toBeNull()
  })
})

describe('urlDaReservaNaPlataforma', () => {
  it('monta o link só para um código válido', () => {
    expect(urlDaReservaNaPlataforma('HMQ4ZK8XYW')).toBe('https://www.airbnb.pt/hosting/reservations/details/HMQ4ZK8XYW')
    expect(urlDaReservaNaPlataforma(null)).toBeNull()
    expect(urlDaReservaNaPlataforma('HM"><script>')).toBeNull()
  })
})

describe('rotuloSemHospede', () => {
  it('mostra o código em vez de um travessão', async () => {
    const { rotuloSemHospede } = await import('./ical-referencias')
    expect(rotuloSemHospede({ referencia_externa: 'HMQ4ZK8XYW' })).toBe('Airbnb · HMQ4ZK8XYW')
    expect(rotuloSemHospede({})).toBe('—')
  })
})
