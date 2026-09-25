import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const propriedades: Array<Record<string, unknown>> = []
const updates: Array<{ patch: Record<string, unknown>; id: unknown }> = []

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const filtros: Array<[string, unknown]> = []
        const obj = {
          eq: (c: string, v: unknown) => { filtros.push([c, v]); return obj },
          maybeSingle: async () => ({
            data: propriedades.find(p => filtros.every(([c, v]) => p[c] === v)) ?? null,
            error: null,
          }),
        }
        return obj
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_c: string, id: unknown) => { updates.push({ patch, id }); return { error: null } },
      }),
    }),
  }),
}))

let utilizador: string | null = 'user_1'
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: utilizador }) }))

const { PATCH } = await import('./route')

const pedido = (corpo: unknown) =>
  new NextRequest('http://localhost/api/fiscal/alojamento', {
    method: 'PATCH',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  propriedades.length = 0
  updates.length = 0
  utilizador = 'user_1'
  propriedades.push({ id: 'p1', owner_id: 'user_1' }, { id: 'p2', owner_id: 'user_2' })
})

describe('PATCH /api/fiscal/alojamento', () => {
  it('grava só os três campos fiscais, mesmo que venham outros', async () => {
    const res = await PATCH(pedido({
      propertyId: 'p1', al_modalidade: 'moradia', al_area_contencao: true, vpt: 123456.789,
      preco_base: 1, owner_id: 'user_2',
    }))
    expect(res.status).toBe(200)
    expect(updates).toEqual([{ patch: { al_modalidade: 'moradia', al_area_contencao: true, vpt: 123456.79 }, id: 'p1' }])
  })

  it('recusa modalidade fora do conjunto e VPT negativo', async () => {
    expect((await PATCH(pedido({ propertyId: 'p1', al_modalidade: 'hostel' }))).status).toBe(400)
    expect((await PATCH(pedido({ propertyId: 'p1', vpt: -1 }))).status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('não deixa escrever no alojamento de outro anfitrião', async () => {
    const res = await PATCH(pedido({ propertyId: 'p2', al_modalidade: 'moradia' }))
    expect(res.status).toBe(404)
    expect(updates).toHaveLength(0)
  })

  it('exige sessão', async () => {
    utilizador = null
    expect((await PATCH(pedido({ propertyId: 'p1', vpt: 1 }))).status).toBe(401)
  })

  it('vazio apaga a modalidade e o VPT', async () => {
    await PATCH(pedido({ propertyId: 'p1', al_modalidade: '', vpt: null }))
    expect(updates[0].patch).toEqual({ al_modalidade: null, vpt: null })
  })
})
