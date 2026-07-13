import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const sendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}))

const deleted: string[] = []
let subsRows: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = []

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: async () => ({ data: subsRows, error: null }) }),
      delete: () => ({ eq: async (_col: string, id: string) => { deleted.push(id); return { error: null } } }),
    }),
  }),
}))

const { sendPushToOwner } = await import('./push')

const SUB = { id: 'sub-1', endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' }

beforeEach(() => {
  sendNotification.mockReset()
  deleted.length = 0
  subsRows = [SUB]
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
})

describe('sendPushToOwner', () => {
  it('envia para todas as subscrições do owner', async () => {
    subsRows = [SUB, { ...SUB, id: 'sub-2', endpoint: 'https://push.example/y' }]
    sendNotification.mockResolvedValue({})
    const sent = await sendPushToOwner('owner-1', { title: 'T', body: 'B', url: '/x' })
    expect(sent).toBe(2)
    const [subArg, payload] = sendNotification.mock.calls[0]
    expect((subArg as { endpoint: string }).endpoint).toBe('https://push.example/x')
    expect(JSON.parse(payload as string)).toEqual({ title: 'T', body: 'B', url: '/x' })
  })

  it('devolve 0 sem ownerId ou sem VAPID configurado', async () => {
    expect(await sendPushToOwner(null, { title: 'T', body: 'B' })).toBe(0)
    delete process.env.VAPID_PRIVATE_KEY
    expect(await sendPushToOwner('owner-1', { title: 'T', body: 'B' })).toBe(0)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('remove subscrições mortas (410) e continua', async () => {
    subsRows = [SUB, { ...SUB, id: 'sub-2', endpoint: 'https://push.example/y' }]
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({})
    const sent = await sendPushToOwner('owner-1', { title: 'T', body: 'B' })
    expect(sent).toBe(1)
    expect(deleted).toEqual(['sub-1'])
  })

  it('não lança com erros transientes (500)', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }))
    const sent = await sendPushToOwner('owner-1', { title: 'T', body: 'B' })
    expect(sent).toBe(0)
    expect(deleted).toEqual([])
  })
})
