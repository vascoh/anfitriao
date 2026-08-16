import { describe, it, expect } from 'vitest'
import { prontidaoDoSite, motivoParaNaoPublicar, NOME_POR_OMISSAO } from './prontidao-site'
import type { Property } from './types'

function propriedade(over: Partial<Property> = {}): Property {
  return {
    id: 'p1', nome: 'T1 Amora', tipo: 'apartamento', endereco: '', cidade: 'Amora',
    capacidade: 2, quartos: 1, casasBanho: 1, comodidades: [],
    instrucoes_checkin: '', regras_casa: '', preco_base: 80, cor: '#000',
    ativo: true, criado_em: '2026-01-01',
    ...over,
  } as Property
}

const COMPLETO = {
  nome: 'Casa de Vasco',
  slug: 'casadevasco',
  email: 'vasco@exemplo.pt',
  telefone: '',
  descricao: 'Uma casa em Amora',
  host_nome: 'Vasco',
  host_bio: 'Anfitrião desde 2019',
}

describe('prontidaoDoSite', () => {
  it('com o essencial preenchido, pode publicar', () => {
    const r = prontidaoDoSite(COMPLETO, [propriedade({ imagem_url: 'https://exemplo/foto.jpg' })])
    expect(r.podePublicar).toBe(true)
    expect(r.emFalta).toHaveLength(0)
  })

  it('o nome de fábrica não conta como nome', () => {
    /* É o que aconteceu na primeira conta real: o site foi publicado a
     * chamar-se "Reservas Diretas" e ninguém reparou durante meses, porque
     * nada o assinalava. */
    const r = prontidaoDoSite(
      { ...COMPLETO, nome: NOME_POR_OMISSAO },
      [propriedade({ imagem_url: 'https://exemplo/foto.jpg' })],
    )
    expect(r.podePublicar).toBe(false)
    expect(r.emFalta.map(i => i.chave)).toEqual(['nome'])
    expect(r.itens.find(i => i.chave === 'nome')?.ajuda).toContain('fábrica')
  })

  it('sem endereço não há sequer URL para partilhar', () => {
    const r = prontidaoDoSite({ ...COMPLETO, slug: undefined }, [propriedade({ imagem_url: 'x' })])
    expect(r.emFalta.map(i => i.chave)).toContain('endereco')
  })

  it('telefone sozinho chega como contacto', () => {
    const r = prontidaoDoSite(
      { ...COMPLETO, email: '', telefone: '+351 912 345 678' },
      [propriedade({ imagem_url: 'x' })],
    )
    expect(r.podePublicar).toBe(true)
  })

  it('sem contacto nenhum não publica', () => {
    const r = prontidaoDoSite({ ...COMPLETO, email: '', telefone: '' }, [propriedade({ imagem_url: 'x' })])
    expect(r.emFalta.map(i => i.chave)).toContain('contacto')
  })

  it('uma foto na galeria chega', () => {
    const r = prontidaoDoSite(COMPLETO, [propriedade({ fotos: ['https://exemplo/1.jpg'] })])
    expect(r.podePublicar).toBe(true)
  })

  it('sem foto nenhuma não publica — ninguém reserva às cegas', () => {
    const r = prontidaoDoSite(COMPLETO, [propriedade()])
    expect(r.emFalta.map(i => i.chave)).toContain('foto')
  })

  it('um alojamento inativo com foto não conta', () => {
    const r = prontidaoDoSite(COMPLETO, [propriedade({ ativo: false, imagem_url: 'x' })])
    expect(r.emFalta.map(i => i.chave)).toContain('foto')
  })

  it('sem alojamentos, a ajuda diz para criar um primeiro', () => {
    const r = prontidaoDoSite(COMPLETO, [])
    expect(r.itens.find(i => i.chave === 'foto')?.ajuda).toContain('Cria primeiro')
  })

  it('descrição e apresentação não impedem publicar', () => {
    const r = prontidaoDoSite(
      { ...COMPLETO, descricao: '', host_nome: '', host_bio: '' },
      [propriedade({ imagem_url: 'x' })],
    )
    expect(r.podePublicar).toBe(true)
    expect(r.itens.filter(i => !i.feito).map(i => i.chave)).toEqual(['descricao', 'apresentacao'])
  })

  it('sem definições nenhumas, falta tudo o que é essencial', () => {
    const r = prontidaoDoSite(null, [])
    expect(r.emFalta.map(i => i.chave)).toEqual(['endereco', 'nome', 'contacto', 'foto'])
    expect(r.feitos).toBe(0)
  })
})

describe('motivoParaNaoPublicar', () => {
  it('uma frase só, com o que falta', () => {
    const r = prontidaoDoSite({ ...COMPLETO, nome: NOME_POR_OMISSAO, email: '', telefone: '' }, [])
    const frase = motivoParaNaoPublicar(r.emFalta)
    expect(frase).toContain('nome do alojamento')
    expect(frase).toContain(' e ')
  })

  it('vazio quando não falta nada', () => {
    expect(motivoParaNaoPublicar([])).toBe('')
  })
})
