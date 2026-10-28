import { describe, expect, it } from 'vitest'
import { dominioDaPlataforma, dominioRaiz, eRaiz, estadoDominio, identificarFornecedor, nomeRelativo, normalizarDominio, problemaDominio, valorServe } from './dominios'

describe('domínios próprios', () => {
  it('normaliza um domínio colado como URL', () => {
    expect(normalizarDominio(' HTTPS://WWW.CasaDoMar.PT/ ')).toBe('www.casadomar.pt')
  })

  it('recusa paths, portas, IPs e wildcards', () => {
    expect(normalizarDominio('casadomar.pt/quartos')).toBeNull()
    expect(normalizarDominio('casadomar.pt:3000')).toBeNull()
    expect(problemaDominio(normalizarDominio('127.0.0.1'))).toMatch(/domínio/)
    expect(problemaDominio(normalizarDominio('*.casadomar.pt'))).not.toBeNull()
  })

  it('não deixa um cliente reclamar os domínios da plataforma', () => {
    expect(dominioDaPlataforma('anfitrioes.pt')).toBe(true)
    expect(dominioDaPlataforma('app.anfitrioes.pt')).toBe(true)
    expect(dominioDaPlataforma('cliente.vercel.app')).toBe(true)
    expect(dominioDaPlataforma('casadomar.pt')).toBe(false)
  })

  it('só fica ativo depois das duas verificações', () => {
    expect(estadoDominio(true, true)).toBe('ativo')
    expect(estadoDominio(true, false)).toBe('pendente')
    expect(estadoDominio(false, false, 'falhou')).toBe('erro')
  })
})

describe('registos de um domínio próprio', () => {
  it('reconhece a raiz em .pt e em .com.pt', () => {
    expect(dominioRaiz('casadomar.pt')).toBe('casadomar.pt')
    expect(dominioRaiz('casadomar.com.pt')).toBe('casadomar.com.pt')
    expect(dominioRaiz('reservas.casadomar.com.pt')).toBe('casadomar.com.pt')
    expect(eRaiz('casadomar.com.pt')).toBe(true)
    expect(eRaiz('www.casadomar.pt')).toBe(false)
  })

  it('escreve o nome como no painel do fornecedor', () => {
    expect(nomeRelativo('casadomar.pt', 'casadomar.pt')).toBe('@')
    expect(nomeRelativo('_vercel.casadomar.pt.', 'casadomar.pt')).toBe('_vercel')
    expect(nomeRelativo('www', 'casadomar.pt')).toBe('www')
  })

  it('aceita o IP e o CNAME antigos e os recomendados pela Vercel', () => {
    expect(valorServe({ tipo: 'A', valor: '216.198.79.1' }, '76.76.21.21')).toBe(true)
    expect(valorServe({ tipo: 'A', valor: '216.198.79.1' }, '185.1.2.3')).toBe(false)
    expect(valorServe({ tipo: 'CNAME', valor: 'abc.vercel-dns-017.com' }, 'cname.vercel-dns.com.')).toBe(true)
    expect(valorServe({ tipo: 'CNAME', valor: 'cname.vercel-dns.com' }, 'casadomar.wixdns.net')).toBe(false)
    expect(valorServe({ tipo: 'TXT', valor: 'vc-domain-verify=x' }, '"vc-domain-verify=x"')).toBe(true)
  })

  it('identifica o fornecedor pelos nameservers', () => {
    expect(identificarFornecedor(['ada.ns.cloudflare.com'])?.id).toBe('cloudflare')
    expect(identificarFornecedor(['ns51.domaincontrol.com.'])?.id).toBe('godaddy')
    expect(identificarFornecedor(['ns1.exemplo.net'])).toBeNull()
  })
})
