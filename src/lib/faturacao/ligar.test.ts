import { describe, it, expect } from 'vitest'
import { normalizarSubdominio, escolherSerie } from './ligar'
import type { SerieExistente } from './types'

describe('normalizarSubdominio', () => {
  it('aceita o nome da conta', () => {
    expect(normalizarSubdominio('vascootelocoutinh')).toBe('vascootelocoutinh')
    expect(normalizarSubdominio('  Casa-Do-Mar ')).toBe('casa-do-mar')
  })

  it('aceita o endereço da aplicação, com caminho e parâmetros', () => {
    expect(normalizarSubdominio(
      'https://vascootelocoutinh.web.invoicexpress.com/invoices?page=1&type=Invoice',
    )).toBe('vascootelocoutinh')
  })

  it('aceita o endereço da API', () => {
    expect(normalizarSubdominio('https://minhaconta.app.invoicexpress.com')).toBe('minhaconta')
    expect(normalizarSubdominio('minhaconta.app.invoicexpress.com/')).toBe('minhaconta')
  })

  it('recusa os subdomínios da própria plataforma', () => {
    expect(normalizarSubdominio('https://www.app.invoicexpress.com/users/api')).toBeNull()
    expect(normalizarSubdominio('api')).toBeNull()
  })

  it('recusa lixo', () => {
    expect(normalizarSubdominio('')).toBeNull()
    expect(normalizarSubdominio('   ')).toBeNull()
    expect(normalizarSubdominio('conta com espaços')).toBeNull()
    expect(normalizarSubdominio('-comeca-por-hifen')).toBeNull()
  })
})

const serie = (p: Partial<SerieExistente>): SerieExistente => ({
  id: '1', nome: 'A', padrao: false, comunicada: true, ultimaFaturaRecibo: 0, ...p,
})

describe('escolherSerie', () => {
  it('prefere a série padrão registada na AT', () => {
    const r = escolherSerie([
      serie({ id: '1', nome: 'VASCO', ultimaFaturaRecibo: 0 }),
      serie({ id: '2', nome: 'seria-a', padrao: true, ultimaFaturaRecibo: 152 }),
    ])
    expect(r?.id).toBe('2')
  })

  it('ignora a padrão se não estiver registada, e escolhe a mais usada', () => {
    const r = escolherSerie([
      serie({ id: '1', padrao: true, comunicada: false }),
      serie({ id: '2', ultimaFaturaRecibo: 3 }),
      serie({ id: '3', ultimaFaturaRecibo: 40 }),
    ])
    expect(r?.id).toBe('3')
  })

  it('devolve null sem nenhuma série registada', () => {
    expect(escolherSerie([serie({ comunicada: false })])).toBeNull()
    expect(escolherSerie([])).toBeNull()
  })
})
