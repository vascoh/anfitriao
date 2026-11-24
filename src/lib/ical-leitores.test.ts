import { describe, it, expect } from 'vitest'
import { eGestorDeCanais } from './ical-guias'
import { gestorSemLerAsDiretas, leitorDoPedido, userAgentParaGuardar, haQuantoTempo, leituraAtrasada, leiturasDoAlojamento, type LeituraIcal } from './ical-leitores'

describe('leitorDoPedido', () => {
  it('reconhece as plataformas pelo user-agent', () => {
    expect(leitorDoPedido('Airbnb/1.0 (calendar sync)', null)).toBe('airbnb')
    expect(leitorDoPedido('Mozilla/5.0 (compatible; Airbnb)', null)).toBe('airbnb')
    expect(leitorDoPedido('Booking.com iCal importer', null)).toBe('booking')
    expect(leitorDoPedido('HomeAway-Calendar/2', null)).toBe('vrbo')
    expect(leitorDoPedido('Amenitiz-Sync', null)).toBe('amenitiz')
    expect(leitorDoPedido('Google-Calendar-Importer', null)).toBe('google')
  })

  it('não conta o anfitrião a abrir o endereço no navegador', () => {
    expect(leitorDoPedido('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1', 'pt-PT,pt;q=0.9')).toBeNull()
  })

  it('um servidor desconhecido conta como «outro», para se afinar a lista', () => {
    expect(leitorDoPedido('python-requests/2.32', null)).toBe('outro')
    expect(leitorDoPedido(null, null)).toBe('outro')
    expect(leitorDoPedido('Mozilla/5.0 (compatible; SomeFetcher)', null)).toBe('outro')
  })
})

describe('userAgentParaGuardar', () => {
  it('trunca e limpa', () => {
    expect(userAgentParaGuardar('a\nb')).toBe('a b')
    expect(userAgentParaGuardar('x'.repeat(500))!.length).toBe(200)
    expect(userAgentParaGuardar(null)).toBeNull()
  })
})

describe('tempo desde a leitura', () => {
  const agora = new Date('2026-11-24T17:00:00Z')
  it('diz-se em palavras', () => {
    expect(haQuantoTempo('2026-11-24T16:59:50Z', agora)).toBe('agora mesmo')
    expect(haQuantoTempo('2026-11-24T16:48:00Z', agora)).toBe('há 12 min')
    expect(haQuantoTempo('2026-11-24T14:00:00Z', agora)).toBe('há 3 h')
    expect(haQuantoTempo('2026-11-21T17:00:00Z', agora)).toBe('há 3 dias')
  })
  it('mais de um dia sem leitura é preocupante', () => {
    expect(leituraAtrasada('2026-11-24T10:00:00Z', agora)).toBe(false)
    expect(leituraAtrasada('2026-11-23T10:00:00Z', agora)).toBe(true)
  })
})

describe('leiturasDoAlojamento', () => {
  it('uma linha por leitor, a mais recente primeiro, só do alojamento pedido', () => {
    const l: LeituraIcal[] = [
      { propriedade_id: 'a', leitor: 'airbnb', origem: 'todas', ultima_leitura: '2026-11-24T10:00:00Z' },
      { propriedade_id: 'a', leitor: 'airbnb', origem: 'diretas', ultima_leitura: '2026-11-24T12:00:00Z' },
      { propriedade_id: 'a', leitor: 'booking', origem: 'todas', ultima_leitura: '2026-11-24T16:00:00Z' },
      { propriedade_id: 'b', leitor: 'vrbo', origem: 'todas', ultima_leitura: '2026-11-24T16:30:00Z' },
    ]
    const r = leiturasDoAlojamento(l, 'a')
    expect(r.map(x => x.leitor)).toEqual(['booking', 'airbnb'])
    expect(r[1].origem).toBe('diretas')
  })
})

describe('gestorSemLerAsDiretas', () => {
  const amenitiz = 'https://casa.amenitiz.io/ical/abc.ics'
  const airbnb = 'https://www.airbnb.pt/calendar/ical/1.ics?s=x'

  it('avisa quando o Amenitiz está ligado e ninguém lê as diretas', () => {
    expect(gestorSemLerAsDiretas([amenitiz], [], eGestorDeCanais)).toBe(true)
    expect(gestorSemLerAsDiretas([amenitiz], [{ origem: 'todas' }], eGestorDeCanais)).toBe(true)
  })
  it('cala-se quando alguém lê o feed das diretas', () => {
    expect(gestorSemLerAsDiretas([amenitiz], [{ origem: 'diretas' }], eGestorDeCanais)).toBe(false)
  })
  it('sem gestor de canais não se aplica', () => {
    expect(gestorSemLerAsDiretas([airbnb], [], eGestorDeCanais)).toBe(false)
    expect(gestorSemLerAsDiretas([], [], eGestorDeCanais)).toBe(false)
  })
})
