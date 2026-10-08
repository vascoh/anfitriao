import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const {
  assinaturaMetaValida, enderecoDeResposta, rececaoEmailAtiva, reservaDoEndereco, reservaMaisRelevante,
} = await import('./mensagens-server')

const RESERVA = '0b7d4c1e-2a3f-4e5d-9c8b-1a2b3c4d5e6f'

describe('endereço de resposta por conversa', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    vi.stubEnv('INBOUND_EMAIL_DOMAIN', 'in.anfitrioes.pt')
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_teste')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('ida e volta: o endereço devolve a reserva', () => {
    const endereco = enderecoDeResposta(RESERVA)!
    expect(endereco).toMatch(/^r\+0b7d4c1e-[a-z0-9-]+\.[a-z0-9_-]{16}@in\.anfitrioes\.pt$/)
    expect(reservaDoEndereco(endereco)).toBe(RESERVA)
    // Os clientes de email podem pôr o endereço em maiúsculas.
    expect(reservaDoEndereco(endereco.toUpperCase())).toBe(RESERVA)
  })

  it('não aceita outra reserva com a assinatura desta, nem outro domínio', () => {
    const endereco = enderecoDeResposta(RESERVA)!
    const assinatura = endereco.split('.')[endereco.split('.').length - 3]
    expect(reservaDoEndereco(endereco.replace(RESERVA, RESERVA.replace('0b7d', '0b7e')))).toBeNull()
    expect(reservaDoEndereco(endereco.replace('in.anfitrioes.pt', 'outro.pt'))).toBeNull()
    expect(assinatura).toBeTruthy()
    expect(reservaDoEndereco(`r+${RESERVA}.aaaaaaaaaaaaaaaa@in.anfitrioes.pt`)).toBeNull()
  })

  it('sem domínio, chave ou segredo do webhook não há endereço — responde-se ao email do alojamento', () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    expect(rececaoEmailAtiva()).toBe(false)
    expect(enderecoDeResposta(RESERVA)).toBeNull()
  })

  it('recusa ids que não cabem num endereço', () => {
    expect(enderecoDeResposta('ABC')).toBeNull()
    expect(enderecoDeResposta('a b')).toBeNull()
  })
})

describe('assinatura dos webhooks da Meta', () => {
  it('aceita só o HMAC do corpo com o segredo da app', () => {
    const corpo = '{"entry":[]}'
    const boa = `sha256=${createHmac('sha256', 'segredo').update(corpo).digest('hex')}`
    expect(assinaturaMetaValida(corpo, boa, 'segredo')).toBe(true)
    expect(assinaturaMetaValida(corpo, boa, 'outro')).toBe(false)
    expect(assinaturaMetaValida(`${corpo} `, boa, 'segredo')).toBe(false)
    expect(assinaturaMetaValida(corpo, null, 'segredo')).toBe(false)
    expect(assinaturaMetaValida(corpo, 'sha1=abc', 'segredo')).toBe(false)
  })
})

describe('reservaMaisRelevante', () => {
  const r = (id: string, check_in: string, check_out: string, estado = 'confirmada') =>
    ({ id, hospede_id: 'g', owner_id: 'u', check_in, check_out, estado })

  it('prefere a estadia em curso ou a próxima', () => {
    const lista = [r('passada', '2026-01-01', '2026-01-05'), r('proxima', '2026-11-01', '2026-11-04'), r('mais-tarde', '2027-02-01', '2027-02-03')]
    expect(reservaMaisRelevante(lista, '2026-10-08')?.id).toBe('proxima')
    expect(reservaMaisRelevante([...lista, r('agora', '2026-10-06', '2026-10-10')], '2026-10-08')?.id).toBe('agora')
  })

  it('sem futuras, a última; canceladas só se não houver outras', () => {
    expect(reservaMaisRelevante([r('a', '2025-01-01', '2025-01-03'), r('b', '2026-03-01', '2026-03-03')], '2026-10-08')?.id).toBe('b')
    expect(reservaMaisRelevante([r('c', '2026-11-01', '2026-11-03', 'cancelada'), r('d', '2026-02-01', '2026-02-03')], '2026-10-08')?.id).toBe('d')
    expect(reservaMaisRelevante([], '2026-10-08')).toBeNull()
  })
})
