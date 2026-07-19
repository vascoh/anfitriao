import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { EmailMessage, EmailProvider, SendResult } from './types'

// server-only é um marcador de build do Next — neutralizar nos testes
vi.mock('server-only', () => ({}))

const settingsMock = vi.fn()
vi.mock('@/lib/db-admin', () => ({
  adminGetWebsiteSettings: (ownerId?: string | null) => settingsMock(ownerId),
}))

const { platformFrom, propertyFrom, PLATFORM_NAME } = await import('./config')
const { identityFromSettings } = await import('./identity')
const { _setEmailProvider } = await import('./providers')
const { emailService } = await import('./service')

class FakeProvider implements EmailProvider {
  readonly name = 'fake'
  sent: EmailMessage[] = []
  async send(msg: EmailMessage): Promise<SendResult> {
    this.sent.push(msg)
    return { ok: true, id: 'fake-id' }
  }
}

const SETTINGS = {
  enabled: true,
  nome: 'Casa de Vasco',
  descricao: '',
  logo_texto: 'Casa de Vasco',
  host_nome: 'Vasco',
  email: 'vasco@example.com',
  email_reservas: 'reservas@casadevasco.pt',
  telefone: '+351 910 000 000',
  min_noites: 1,
  antecedencia_dias: 0,
  cor_primaria: '#336699',
}

let provider: FakeProvider

beforeEach(() => {
  provider = new FakeProvider()
  _setEmailProvider(provider)
  settingsMock.mockResolvedValue({ ...SETTINGS })
})

afterEach(() => {
  _setEmailProvider(null)
})

describe('from headers', () => {
  it('platformFrom usa o nome e endereço da plataforma', () => {
    expect(platformFrom()).toMatch(new RegExp(`^${PLATFORM_NAME} <.+@.+>$`))
  })

  it('propertyFrom envia sempre pelo domínio da plataforma, com "via"', () => {
    const from = propertyFrom('Casa de Vasco')
    expect(from).toContain(`Casa de Vasco via ${PLATFORM_NAME}`)
    expect(from).not.toContain('casadevasco.pt') // nunca o domínio do cliente
  })

  it('propertyFrom sanitiza caracteres de header injection', () => {
    const from = propertyFrom('Casa\r\nBcc: x@evil.com <fake@evil.com>')
    expect(from).not.toContain('\r')
    expect(from).not.toContain('<fake@evil.com>')
  })
})

describe('identityFromSettings', () => {
  it('deriva displayName, replyTo (email_reservas primeiro) e cores', () => {
    const id = identityFromSettings({ ...SETTINGS })
    expect(id.displayName).toBe('Casa de Vasco')
    expect(id.replyTo).toBe('reservas@casadevasco.pt')
    expect(id.primaryColor).toBe('#336699')
  })

  it('cai para o email principal e cor default quando não há overrides', () => {
    const id = identityFromSettings({ ...SETTINGS, email_reservas: null, cor_primaria: 'red' })
    expect(id.replyTo).toBe('vasco@example.com')
    expect(id.primaryColor).toBe('#C2714F') // 'red' não é hex válido
  })
})

describe('emailService', () => {
  const STAY = {
    ownerId: 'owner-1',
    guestName: 'João Silva',
    guestEmail: 'joao@example.com',
    propertyName: 'Casa de Vasco',
    checkIn: '2026-08-10',
    checkOut: '2026-08-12',
    numNights: 2,
    numHospedes: 2,
    total: 160,
  }

  it('email ao hóspede: From "via Anfitriões" + Reply-To do alojamento', async () => {
    const res = await emailService.sendReservationRequest({ ...STAY, notas: null })
    expect(res.ok).toBe(true)
    const msg = provider.sent[0]
    expect(msg.to).toBe('joao@example.com')
    expect(msg.from).toContain(`Casa de Vasco via ${PLATFORM_NAME}`)
    expect(msg.replyTo).toBe('reservas@casadevasco.pt')
    expect(msg.html).toContain('Powered by')
    expect(msg.html).toContain('#336699') // cor primária do alojamento
  })

  it('email de plataforma (trial): From da plataforma, sem identidade de alojamento', async () => {
    await emailService.sendTrialEnding({ to: 'vasco@example.com', firstName: 'Vasco', daysLeft: 3, trialDate: '22 de julho' })
    const msg = provider.sent[0]
    expect(msg.from).toBe(platformFrom())
    expect(msg.replyTo).toBeUndefined()
    expect(msg.html).toContain('Powered by')
  })

  it('confirmação de reserva inclui o link de check-in online', async () => {
    await emailService.sendReservationConfirmation({ ...STAY, bookingId: 'bk-1', instrucoes: null })
    expect(provider.sent[0].html).toContain('/checkin/bk-1')
  })

  it('conteúdo do hóspede é escapado (sem injeção de HTML)', async () => {
    await emailService.sendReservationRequest({ ...STAY, guestName: '<script>x</script> Mal', notas: null })
    expect(provider.sent[0].html).not.toContain('<script>')
  })
})
