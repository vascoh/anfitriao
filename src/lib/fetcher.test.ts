import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBookings, fetchGuests, fetchProperties } from './fetcher'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchers autenticados', () => {
  it('mantém o fallback antigo quando o ecrã não pede erro explícito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    await expect(fetchGuests()).resolves.toEqual([])
  })

  it('não confunde uma resposta HTTP com erro com uma lista vazia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    await expect(fetchBookings(undefined, { exigirSucesso: true }))
      .rejects.toThrow('Pedido falhou (500)')
  })

  it('devolve os dados quando a resposta é válida em modo estrito', async () => {
    const alojamentos = [{ id: 'p1', nome: 'Casa do Mar' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(alojamentos)))

    await expect(fetchProperties({ exigirSucesso: true })).resolves.toEqual(alojamentos)
  })
})
