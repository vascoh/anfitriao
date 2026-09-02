import { describe, it, expect, vi } from 'vitest'
import {
  GUIAS,
  GUIA_AMENITIZ,
  nomeDoFeed,
  eGestorDeCanais,
  deveAvisarDuplicacao,
} from './ical-guias'

vi.mock('server-only', () => ({}))

const { isAllowedIcalUrl, mensagemUrlRecusado } = await import('./ical-fetch')

describe('guias', () => {
  it('todas as fontes têm passos e exemplo', () => {
    for (const [fonte, guia] of Object.entries({ ...GUIAS, amenitiz: GUIA_AMENITIZ })) {
      expect(guia.passos.length, fonte).toBeGreaterThan(0)
      expect(guia.exemploUrl, fonte).toMatch(/^https:\/\//)
    }
  })

  it('os exemplos das OTA passam na allowlist — um guia que ensina um URL recusado é pior que nenhum', () => {
    // Só os que são endereços concretos; os genéricos têm reticências no domínio.
    expect(isAllowedIcalUrl('https://www.airbnb.pt/calendar/ical/12345678.ics?s=x')).toBe(true)
    expect(isAllowedIcalUrl('https://ical.booking.com/v1/export?t=x')).toBe(true)
    expect(isAllowedIcalUrl('https://www.vrbo.com/icalendar/abc.ics')).toBe(true)
  })
})

describe('eGestorDeCanais', () => {
  it('reconhece os gestores suportados', () => {
    expect(eGestorDeCanais('https://app.amenitiz.io/ical/abc.ics')).toBe(true)
    expect(eGestorDeCanais('https://login.smoobu.com/ical/x')).toBe(true)
  })

  it('não confunde uma OTA com um gestor', () => {
    expect(eGestorDeCanais('https://www.airbnb.pt/calendar/ical/1.ics')).toBe(false)
    expect(eGestorDeCanais('lixo')).toBe(false)
  })
})

describe('deveAvisarDuplicacao', () => {
  const amenitiz = 'https://app.amenitiz.io/ical/abc.ics'
  const airbnb = 'https://www.airbnb.pt/calendar/ical/1.ics'

  it('avisa ao juntar uma OTA a um gestor de canais já ligado', () => {
    expect(deveAvisarDuplicacao([amenitiz], 'airbnb')).toBe(true)
    expect(deveAvisarDuplicacao([amenitiz], 'booking')).toBe(true)
  })

  it('não avisa quando só há OTA', () => {
    expect(deveAvisarDuplicacao([airbnb], 'booking')).toBe(false)
  })

  it('não avisa quando não há nada ligado', () => {
    expect(deveAvisarDuplicacao([], 'airbnb')).toBe(false)
  })

  it('não avisa ao acrescentar outra fonte que não seja OTA', () => {
    expect(deveAvisarDuplicacao([amenitiz], 'outro')).toBe(false)
  })
})

describe('mensagemUrlRecusado', () => {
  it('nomeia o domínio recusado, para o pedido ser concreto', () => {
    expect(mensagemUrlRecusado('https://ical.plataformax.pt/abc.ics')).toContain('ical.plataformax.pt')
  })

  it('distingue http de domínio não suportado', () => {
    expect(mensagemUrlRecusado('http://www.airbnb.pt/x.ics')).toContain('https://')
  })

  it('distingue um URL partido', () => {
    expect(mensagemUrlRecusado('isto não é um url')).toContain('inválido')
  })
})

describe('nomeDoFeed', () => {
  it('lê o gestor de canais do endereço', () => {
    /* Sem isto, os três feeds do Amenitiz ficavam todos chamados «Outro» — que
     * é o rótulo da fonte `outro`, a única que serve para um gestor de canais.
     * Aparecia na página de canais e no alerta: «Quarto de Casal · Outro». */
    expect(nomeDoFeed('https://app.amenitiz.io/ical/abc.ics', 'Outro')).toBe('Amenitiz')
    expect(nomeDoFeed('https://smoobu.com/ical/x.ics', 'Outro')).toBe('Smoobu')
  })

  it('lê também as plataformas', () => {
    expect(nomeDoFeed('https://www.airbnb.pt/calendar/ical/1.ics?s=x', 'Airbnb')).toBe('Airbnb')
    expect(nomeDoFeed('https://ical.booking.com/v1/export?t=x', 'Booking.com')).toBe('Booking.com')
  })

  it('um domínio desconhecido fica com o rótulo da fonte', () => {
    expect(nomeDoFeed('https://calendario.exemplo.pt/x.ics', 'Outro')).toBe('Outro')
  })

  it('um endereço ilegível não rebenta — quem o valida é outro', () => {
    expect(nomeDoFeed('nao-e-um-url', 'Outro')).toBe('Outro')
  })
})
