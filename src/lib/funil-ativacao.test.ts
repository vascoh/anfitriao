import { describe, it, expect } from 'vitest'
import { calcularFunil, type ContaFunil, type ReservaFunil } from './funil-ativacao'

const conta = (id: string, criado_em = '2026-09-01T10:00:00Z'): ContaFunil =>
  ({ clerk_user_id: id, email: `${id}@x.pt`, criado_em, estado: 'trial' })

const reserva = (owner: string, over: Partial<ReservaFunil> = {}): ReservaFunil => ({
  owner_id: owner, criado_em: '2026-09-10T10:00:00Z', hospede_id: 'g1',
  uid_externo: null, notas: null, origem: 'direto', estado: 'confirmada', historico: [], ...over,
})

const AGORA = new Date('2026-09-27T12:00:00Z')

describe('calcularFunil', () => {
  it('um anfitrião que chega ao fim tem todos os passos e não está parado', () => {
    const f = calcularFunil({
      contas: [conta('a')],
      propriedades: [{ owner_id: 'a', criado_em: '2026-09-02T10:00:00Z', ical_feeds: [{ last_sync: '2026-09-27T04:00:00Z' }] }],
      sites: [{ owner_id: 'a', enabled: true, slug: 'casa-a' }],
      reservas: [reserva('a', { historico: [{ tipo: 'checkin_online', data: '2026-09-11T09:00:00Z' }] })],
      agora: AGORA,
    })
    const l = f.linhas[0]
    expect(l.paradoEm).toBeNull()
    expect(l.passos).toEqual({
      conta: '2026-09-01T10:00:00Z', propriedade: '2026-09-02T10:00:00Z', calendario: true,
      site: true, reserva: '2026-09-10T10:00:00Z', checkin: '2026-09-11T09:00:00Z',
    })
    expect(l.diasDesdeRegisto).toBe(26)
  })

  it('«parado em» é o primeiro passo que falta', () => {
    const f = calcularFunil({
      contas: [conta('b')],
      propriedades: [{ owner_id: 'b', criado_em: '2026-09-02T10:00:00Z', ical_feeds: [] }],
      sites: [{ owner_id: 'b', enabled: true, slug: 'b' }],
      reservas: [],
    })
    expect(f.linhas[0].paradoEm).toBe('calendario')
    expect(f.linhas[0].passos.site).toBe(true) // conta-se por si
  })

  it('um calendário com erro não conta como a sincronizar', () => {
    const f = calcularFunil({
      contas: [conta('c')],
      propriedades: [{ owner_id: 'c', criado_em: '2026-09-02T10:00:00Z', ical_feeds: [{ last_sync: '2026-09-27T04:00:00Z', error: '404' }] }],
      sites: [], reservas: [],
    })
    expect(f.linhas[0].passos.calendario).toBeUndefined()
  })

  it('bloqueios e canceladas não são a 1.ª reserva', () => {
    const f = calcularFunil({
      contas: [conta('d')], propriedades: [], sites: [],
      reservas: [
        reserva('d', { hospede_id: null, uid_externo: 'f::1', notas: 'Quarto indisponível', origem: 'outro', criado_em: '2026-09-05T00:00:00Z' }),
        reserva('d', { estado: 'cancelada', criado_em: '2026-09-06T00:00:00Z' }),
        reserva('d', { criado_em: '2026-09-20T00:00:00Z' }),
      ],
    })
    expect(f.linhas[0].passos.reserva).toBe('2026-09-20T00:00:00Z')
  })

  it('uma reserva do Booking conta (o Booking não distingue, e trata-se como reserva)', () => {
    const f = calcularFunil({
      contas: [conta('e')], propriedades: [], sites: [],
      reservas: [reserva('e', { hospede_id: null, uid_externo: 'b::1', notas: 'CLOSED - Not available', origem: 'booking' })],
    })
    expect(f.linhas[0].passos.reserva).toBeDefined()
  })

  it('a conta interna aparece mas fica fora dos totais', () => {
    const f = calcularFunil({
      contas: [conta('admin'), conta('x')],
      propriedades: [{ owner_id: 'admin', criado_em: '2026-09-02T10:00:00Z' }],
      sites: [], reservas: [], adminUserId: 'admin',
    })
    expect(f.linhas.find(l => l.clerkUserId === 'admin')?.interna).toBe(true)
    expect(f.externas).toBe(1)
    expect(f.totais.conta).toBe(1)
    expect(f.totais.propriedade).toBe(0)
  })
})
