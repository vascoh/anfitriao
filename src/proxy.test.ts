import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Quem passa pelo Clerk no proxy.
 *
 * Um hóspede sem sessão no site do anfitrião, no /book ou no check-in não
 * passa: com a instância de desenvolvimento do Clerk, isso custava-lhe um
 * redirecionamento a clerk.accounts.dev e de volta antes de ver a página.
 * Tudo o resto passa — a app tem de continuar protegida.
 */

const chamadasClerk: string[] = []
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: () => async (req: NextRequest) => { chamadasClerk.push(req.nextUrl.pathname); return undefined },
  createRouteMatcher: () => () => true,
}))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
}))

const { default: proxy, temSessaoClerk } = await import('./proxy')

function pedido(caminho: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(`https://anfitrioes.pt${caminho}`, {
    headers: { host: 'anfitrioes.pt', cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
  })
  return req
}
const ev = {} as Parameters<typeof proxy>[1]

beforeEach(() => { chamadasClerk.length = 0 })

describe('proxy — Clerk só para quem precisa', () => {
  it('hóspede sem sessão nas páginas de hóspede não passa pelo Clerk', async () => {
    for (const caminho of ['/r/casadevasco', '/r/casadevasco/sobre', '/book/abc', '/checkin/xyz']) {
      await proxy(pedido(caminho), ev)
    }
    expect(chamadasClerk).toEqual([])
  })

  it('o anfitrião com sessão passa pelo Clerk no próprio site (pré-visualização do editor)', async () => {
    await proxy(pedido('/r/casadevasco', { __session: 'jwt' }), ev)
    await proxy(pedido('/r/casadevasco', { __client_uat: '1759856000' }), ev)
    expect(chamadasClerk).toEqual(['/r/casadevasco', '/r/casadevasco'])
  })

  it('a app passa sempre pelo Clerk, com ou sem sessão', async () => {
    await proxy(pedido('/hoje'), ev)
    await proxy(pedido('/website/editor'), ev)
    await proxy(pedido('/api/website-settings'), ev)
    await proxy(pedido('/rascunhos'), ev) // começa por «r», não é /r/
    expect(chamadasClerk).toEqual(['/hoje', '/website/editor', '/api/website-settings', '/rascunhos'])
  })

  it('o sitemap antigo é encaminhado para o novo', async () => {
    const res = await proxy(pedido('/r/casadevasco/sitemap.xml'), ev)
    expect(res?.headers.get('x-middleware-rewrite')).toContain('/r/casadevasco/sitemap')
    expect(chamadasClerk).toEqual([])
  })

  it('temSessaoClerk: __client_uat a 0 é sessão terminada', () => {
    expect(temSessaoClerk(pedido('/', { __client_uat: '0' }))).toBe(false)
    expect(temSessaoClerk(pedido('/'))).toBe(false)
  })
})
