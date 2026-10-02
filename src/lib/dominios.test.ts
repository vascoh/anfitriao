import { describe, expect, it } from 'vitest'
import { dominioDaPlataforma, estadoDominio, normalizarDominio, problemaDominio } from './dominios'

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
