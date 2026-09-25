import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
// Cabeçalho e rodapé já estão traduzidos e têm testes próprios; o rodapé é
// async (lê os registos AL) e não se renderiza fora do servidor do Next.
vi.mock('./_components/site-chrome', () => ({
  SiteNav: () => null,
  SiteFooter: () => null,
  WA_SVG: null,
}))

let idioma = 'en'
vi.mock('@/lib/db-admin', () => ({
  adminGetWebsiteSettingsBySlug: async () => ({
    enabled: true, nome: 'Casa Azul', idioma, owner_id: 'o1', telefone: '+351 912 345 678',
    email: 'ola@casaazul.pt', min_noites: 2, host_nome: null, host_bio: null, descricao: null,
  }),
  adminGetProperties: async () => [
    { id: 'p1', nome: 'T1', ativo: true, parent_id: null, cidade: 'Lisboa', endereco: 'Rua X', mostrar_morada_publica: false },
  ],
}))
vi.mock('@/lib/site-theme', () => ({ siteTheme: () => ({ className: '', style: {} }) }))

const params = Promise.resolve({ slug: 'casa-azul' })

async function render(modulo: string): Promise<string> {
  const { default: Pagina } = await import(modulo)
  return renderToStaticMarkup(await Pagina({ params }))
}

beforeEach(() => { idioma = 'en' })

describe('site do anfitrião em inglês', () => {
  it('Sobre', async () => {
    const html = await render('./sobre/page')
    expect(html).toContain('lang="en"')
    expect(html).toContain('Message the host')
    expect(html).toContain('Casa Azul welcomes guests')
    expect(html).not.toContain('Falar com o anfitrião')
  })

  it('Localização', async () => {
    const html = await render('./localizacao/page')
    expect(html).toContain('The exact address is shared once the booking is confirmed.')
    expect(html).toContain('View map')
    expect(html).not.toContain('Ver mapa')
  })

  it('Privacidade, Cookies e Termos', async () => {
    const priv = await render('./privacidade/page')
    expect(priv).toContain('Privacy Policy')
    expect(priv).toContain('ola@casaazul.pt')
    expect(priv).toContain('automatically generated generic template')
    expect(priv).not.toContain('Dados recolhidos')
    expect(await render('./cookies/page')).toContain('Cookie Policy')
    const termos = await render('./termos/page')
    expect(termos).toContain('minimum stay of 2 nights')
  })

  it('em português continua igual', async () => {
    idioma = 'pt'
    const html = await render('./privacidade/page')
    expect(html).toContain('lang="pt-PT"')
    expect(html).toContain('Política de Privacidade')
    expect(html).toContain('Dados recolhidos')
  })
})
