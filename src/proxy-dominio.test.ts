import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Num domínio próprio só existe o site do anfitrião: a app, o login e as APIs
 * privadas dão 404 em vez de abrirem a plataforma no endereço do cliente.
 */

const chamadasClerk: string[] = []
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: () => async (req: NextRequest) => { chamadasClerk.push(req.nextUrl.pathname); return undefined },
  createRouteMatcher: () => () => true,
}))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => ({
        eq: (_c: string, valor: string) => ({
          maybeSingle: async () => {
            if (tabela === 'custom_domains') return { data: valor === 'casadomar.pt' ? { owner_id: 'u1' } : null, error: null }
            return { data: { slug: 'casadomar' }, error: null }
          },
        }),
      }),
    }),
  }),
}))

const { default: proxy } = await import('./proxy')
const ev = {} as Parameters<typeof proxy>[1]

function pedido(caminho: string, host = 'casadomar.pt') {
  return new NextRequest(`https://${host}${caminho}`, { headers: { host } })
}

beforeEach(() => { chamadasClerk.length = 0 })

describe('proxy — domínio próprio', () => {
  it('reescreve as páginas do site para /r/<slug>', async () => {
    const res = await proxy(pedido('/sobre'), ev)
    expect(res?.headers.get('x-middleware-rewrite')).toContain('/r/casadomar/sobre')
  })

  it('a app e o login dão 404, sem passar pelo Clerk', async () => {
    for (const caminho of ['/hoje', '/website/dominio', '/sign-in', '/admin', '/r/outro-site']) {
      const res = await proxy(pedido(caminho), ev)
      expect(res?.headers.get('x-middleware-rewrite'), caminho).toContain('/_nao-existe')
    }
    expect(chamadasClerk).toEqual([])
  })

  it('as APIs privadas respondem 404 em JSON', async () => {
    const res = await proxy(pedido('/api/guests'), ev)
    expect(res?.status).toBe(404)
    expect(await res?.json()).toEqual({ error: 'Não encontrado' })
  })

  it('o que o site do hóspede usa continua a funcionar', async () => {
    const res = await proxy(pedido('/api/book/checkout'), ev)
    expect(res?.headers.get('x-middleware-rewrite') ?? null).toBeNull()
    expect(chamadasClerk).toEqual(['/api/book/checkout'])
    await proxy(pedido('/book/abc/confirmacao'), ev)
    expect(chamadasClerk).toEqual(['/api/book/checkout']) // hóspede sem sessão: sem Clerk
  })

  it('robots.txt aponta para o sitemap do próprio domínio', async () => {
    const res = await proxy(pedido('/robots.txt'), ev)
    expect(await res?.text()).toContain('Sitemap: https://casadomar.pt/sitemap.xml')
  })

  it('o endereço interno redireciona para o caminho limpo', async () => {
    const res = await proxy(pedido('/r/casadomar/sobre'), ev)
    expect(res?.status).toBe(308)
    expect(res?.headers.get('location')).toBe('https://casadomar.pt/sobre')
  })

  it('um domínio desconhecido não é tocado', async () => {
    await proxy(pedido('/hoje', 'outro.pt'), ev)
    expect(chamadasClerk).toEqual(['/hoje'])
  })
})
