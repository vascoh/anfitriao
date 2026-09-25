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

  it('só convida a responder quando há mesmo para onde responder', async () => {
    /* O `replyTo` é o email do alojamento; sem ele a resposta do hóspede vai
     * para o `noreply` da plataforma e ninguém a lê. Prometer "podes
     * responder a este email" nesse caso é mandar a pessoa falar sozinha. */
    await emailService.sendReservationRequest({ ...STAY, notas: null })
    expect(provider.sent[0].html).toContain('Podes responder a este email')

    settingsMock.mockResolvedValue({ ...SETTINGS, email: '', email_reservas: '' })
    provider.sent.length = 0
    await emailService.sendReservationRequest({ ...STAY, notas: null })

    expect(provider.sent[0].replyTo).toBeUndefined()
    expect(provider.sent[0].html).not.toContain('Podes responder a este email')
    expect(provider.sent[0].html).toContain('O anfitrião irá confirmar a reserva')
  })

  it('conteúdo do hóspede é escapado (sem injeção de HTML)', async () => {
    await emailService.sendReservationRequest({ ...STAY, guestName: '<script>x</script> Mal', notas: null })
    expect(provider.sent[0].html).not.toContain('<script>')
  })
})


describe('emails ao hóspede na língua do site', () => {
  const STAY = {
    ownerId: 'o1', propertyName: 'Casa de Vasco', checkIn: '2026-09-12', checkOut: '2026-09-15',
    numNights: 3, numHospedes: 2, total: 300, guestName: 'Anna Schmidt', guestEmail: 'anna@example.com',
  }

  it('site em inglês: assunto, corpo, datas e rodapé em inglês', async () => {
    settingsMock.mockResolvedValue({ ...SETTINGS, idioma: 'en' })
    await emailService.sendReservationConfirmation({ ...STAY, bookingId: 'bk-1' })
    const msg = provider.sent[0]
    expect(msg.subject).toBe('Booking confirmed — Casa de Vasco')
    expect(msg.html).toContain('<html lang="en">')
    expect(msg.html).toContain('Your stay is confirmed!')
    expect(msg.html).toContain('Check in online')
    expect(msg.html).toContain('12 Sept')
    expect(msg.html).toContain('Host:')
    expect(msg.html).not.toContain('Anfitrião:')
    expect(msg.html).not.toContain('set.')
  })

  it('pedido e lembrete de pagamento em inglês', async () => {
    settingsMock.mockResolvedValue({ ...SETTINGS, idioma: 'en' })
    await emailService.sendReservationRequest({ ...STAY, notas: null })
    expect(provider.sent[0].subject).toBe('Booking request received — Casa de Vasco')
    expect(provider.sent[0].html).toContain('We have received your request!')

    await emailService.sendPaymentReminder({ ...STAY, pago: 100, saldo: 200 })
    expect(provider.sent[1].subject).toBe('Payment due — Casa de Vasco · 12 Sept')
    expect(provider.sent[1].html).toContain('Amount due')
  })

  it('site em português: fica como estava', async () => {
    await emailService.sendReservationConfirmation({ ...STAY, bookingId: 'bk-1' })
    const msg = provider.sent[0]
    expect(msg.subject).toBe('Reserva confirmada — Casa de Vasco')
    expect(msg.html).toContain('<html lang="pt-PT">')
    expect(msg.html).toContain('A tua estadia está confirmada!')
    expect(msg.html).toContain('Anfitrião:')
  })
})
