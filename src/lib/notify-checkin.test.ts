import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * O crachá «SIBA ✓» no email de check-in concluído.
 *
 * Esta função tinha a sua própria cópia da regra — a versão antiga, anterior à
 * correção de 2026-09-18, que não olhava para `nacionalidade` nem
 * `pais_residencia`. Os ecrãs diziam «faltam campos» e o email dizia o
 * contrário. Agora chama `sibaComplete` de `lib/labels`, e estes testes
 * prendem-na a ela.
 */

const guardado: { guest: Record<string, unknown> | null } = { guest: null }

vi.mock('@/lib/db-admin', () => ({
  adminGetBookingById: async () => ({
    id: 'b1', hospede_id: 'g1', propriedade_id: 'p1', owner_id: 'user_1',
    check_in: '2026-09-10', num_hospedes: 2,
  }),
  adminGetGuestById: async () => guardado.guest,
  adminGetPropertyById: async () => ({ id: 'p1', nome: 'Casa de Vasco' }),
  adminGetWebsiteSettings: async () => ({ email: 'anfitriao@exemplo.pt' }),
}))

vi.mock('@/lib/push', () => ({ sendPushToOwner: async () => {} }))
vi.mock('@/lib/crypto', () => ({ mascarar: (s: string) => `••••${s.slice(-3)}` }))

const enviados: Array<{ sibaComplete: boolean }> = []

vi.mock('@/lib/email', () => ({
  emailService: {
    sendCheckinComplete: async (p: { sibaComplete: boolean }) => { enviados.push(p) },
  },
}))

const { sendCheckinCompleteNotification } = await import('./notify-checkin')

/** Um boletim que o SIBA aceita: tem os sete campos. */
const COMPLETO = {
  id: 'g1', nome: 'Maria Silva',
  numero_documento: '12345678',
  data_nascimento: '1990-01-01',
  tipo_documento: 'CC',
  sexo: 'F',
  pais_emissao: 'PRT',
  nacionalidade: 'PRT',
  pais_residencia: 'PRT',
}

beforeEach(() => {
  enviados.length = 0
  guardado.guest = { ...COMPLETO }
})

describe('sendCheckinCompleteNotification', () => {
  it('diz SIBA ✓ quando o boletim está mesmo completo', async () => {
    await sendCheckinCompleteNotification('b1')
    expect(enviados).toHaveLength(1)
    expect(enviados[0].sibaComplete).toBe(true)
  })

  // Os dois campos que a cópia antiga desta função ignorava.
  it('não diz SIBA ✓ sem nacionalidade', async () => {
    guardado.guest = { ...COMPLETO, nacionalidade: undefined }
    await sendCheckinCompleteNotification('b1')
    expect(enviados[0].sibaComplete).toBe(false)
  })

  it('não diz SIBA ✓ sem país de residência', async () => {
    guardado.guest = { ...COMPLETO, pais_residencia: undefined }
    await sendCheckinCompleteNotification('b1')
    expect(enviados[0].sibaComplete).toBe(false)
  })

  it('não diz SIBA ✓ sem documento', async () => {
    guardado.guest = { ...COMPLETO, numero_documento: undefined }
    await sendCheckinCompleteNotification('b1')
    expect(enviados[0].sibaComplete).toBe(false)
  })

  it('sem hóspede não diz SIBA ✓', async () => {
    guardado.guest = null
    await sendCheckinCompleteNotification('b1')
    expect(enviados[0].sibaComplete).toBe(false)
  })
})
