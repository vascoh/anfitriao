import { describe, expect, it } from 'vitest'
import { destinoNoDominioProprio, robotsDoDominio } from './dominio-rotas'

describe('rotas num domínio próprio', () => {
  it('serve as páginas do site', () => {
    for (const p of ['/', '/sobre', '/blog/praia', '/p/regras', '/alojamento/abc', '/sitemap.xml']) {
      expect(destinoNoDominioProprio(p)).toBe('site')
    }
  })

  it('deixa passar o que o site do hóspede chama', () => {
    for (const p of ['/book/abc/confirmacao', '/book/abc', '/checkin/r1', '/api/book', '/api/book/checkout', '/api/book/grupo',
      '/api/book-confirmation/r1', '/api/checkin/r1', '/api/documentos/extrair', '/api/og', '/api/pwa-icon/192', '/manifest.json', '/icons/x']) {
      expect(destinoNoDominioProprio(p)).toBe('passa')
    }
  })

  it('fecha a app, o login e as APIs privadas', () => {
    for (const p of ['/hoje', '/reservas', '/website/dominio', '/conta/billing', '/admin', '/sign-in', '/sign-up/x', '/vs/amenitiz',
      '/em-construcao', '/api/dominio', '/api/guests', '/api/upload', '/api/cron/x', '/api/stripe/webhook', '/r/outro-slug', '/book', '/api/bookings']) {
      expect(destinoNoDominioProprio(p)).toBe('nao-existe')
    }
  })

  it('tem robots.txt próprio, com o sitemap do domínio', () => {
    expect(destinoNoDominioProprio('/robots.txt')).toBe('robots')
    expect(robotsDoDominio('casadomar.pt')).toContain('Sitemap: https://casadomar.pt/sitemap.xml')
  })
})
