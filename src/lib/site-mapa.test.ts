import { describe, it, expect } from 'vitest'
import {
  normalizarSecoes, secoesDoInicio, entradasDoMenu, itensPorque, paginaFixaVisivel, paginaPropria,
  paragrafos, slugDePagina, LIMITES,
} from './site-mapa'

describe('mapa do site — valores por omissão', () => {
  it('sem mapa, o site é o de antes: as secções de sempre e as fotografias escondidas', () => {
    /* Um site no ar não pode mudar sozinho por causa de uma funcionalidade
     * nova. A secção de fotografias nasce escondida. */
    expect(secoesDoInicio(null)).toEqual([
      { id: 'alojamentos', visivel: true },
      { id: 'fotos', visivel: false },
      { id: 'porque', visivel: true },
      { id: 'faq', visivel: true },
      { id: 'anfitriao', visivel: true },
    ])
  })

  it('sem mapa, o menu tem as quatro páginas pela ordem de sempre', () => {
    expect(entradasDoMenu(undefined, 'pt').map(e => [e.href, e.label, e.visivel])).toEqual([
      ['/sobre', 'Sobre', true],
      ['/galeria', 'Galeria', true],
      ['/localizacao', 'Localização', true],
      ['/blog', 'Blog', true],
    ])
  })

  it('os textos de «porquê reservar direto» seguem o idioma até o anfitrião os mudar', () => {
    expect(itensPorque({}, 'en')[0].titulo).toBe('No service fees')
    expect(itensPorque({ porque: [{ titulo: '', texto: '' }, { titulo: '', texto: '' }, { titulo: 'Cancelamento até 7 dias', texto: '' }] }, 'pt')
      .map(i => i.titulo)).toEqual(['Sem taxas de serviço', 'Contacto direto', 'Cancelamento até 7 dias'])
  })
})

describe('mapa do site — leitura', () => {
  it('ordem gravada primeiro, secções novas no fim', () => {
    const s = secoesDoInicio({ inicio: [{ id: 'faq', visivel: true }, { id: 'alojamentos', visivel: true }] })
    expect(s.map(x => x.id)).toEqual(['faq', 'alojamentos', 'fotos', 'porque', 'anfitriao'])
  })

  it('o menu respeita a ordem, os nomes e as páginas escondidas', () => {
    const secoes = normalizarSecoes({
      paginas: { blog: { visivel: false }, galeria: { nome: 'Fotos' } },
      paginas_proprias: [{ titulo: 'Regras da casa', texto: 'Sem festas.' }],
      menu: ['p:regras-da-casa', 'galeria'],
    })
    const menu = entradasDoMenu(secoes, 'pt')
    expect(menu.map(e => e.id)).toEqual(['p:regras-da-casa', 'galeria', 'sobre', 'localizacao', 'blog'])
    expect(menu[1].label).toBe('Fotos')
    expect(menu[0].href).toBe('/p/regras-da-casa')
    expect(paginaFixaVisivel(secoes, 'blog')).toBe(false)
    expect(paginaFixaVisivel(secoes, 'sobre')).toBe(true)
    expect(paginaPropria(secoes, 'regras-da-casa')?.texto).toBe('Sem festas.')
  })

  it('parágrafos separados por linha em branco', () => {
    expect(paragrafos('Um.\nainda um.\n\n\nDois.')).toEqual(['Um.\nainda um.', 'Dois.'])
    expect(paragrafos(undefined)).toEqual([])
  })
})

describe('mapa do site — normalização', () => {
  it('ignora o que não é um objeto', () => {
    expect(normalizarSecoes(null)).toEqual({})
    expect(normalizarSecoes('x')).toEqual({})
    expect(normalizarSecoes([1, 2])).toEqual({})
  })

  it('aplica os limites de tamanho e de quantidade', () => {
    const s = normalizarSecoes({
      faq: Array.from({ length: 50 }, (_, i) => ({ pergunta: `P${i}`, resposta: 'r'.repeat(5000) })),
      sobre_texto: 'x'.repeat(LIMITES.sobreTexto + 100),
      paginas_proprias: Array.from({ length: 10 }, (_, i) => ({ titulo: `Página ${i}` })),
    })
    expect(s.faq).toHaveLength(LIMITES.faq)
    expect(s.faq?.[0].resposta).toHaveLength(LIMITES.resposta)
    expect(s.sobre_texto).toHaveLength(LIMITES.sobreTexto)
    expect(s.paginas_proprias).toHaveLength(LIMITES.paginasProprias)
  })

  it('perguntas vazias não ficam gravadas', () => {
    expect(normalizarSecoes({ faq: [{ pergunta: ' ', resposta: '' }, { pergunta: 'Animais?', resposta: 'Sim' }] }).faq)
      .toEqual([{ pergunta: 'Animais?', resposta: 'Sim' }])
  })

  it('slugs das páginas próprias: sem acentos, únicos e sem tapar rotas do site', () => {
    const s = normalizarSecoes({
      paginas_proprias: [
        { titulo: 'Experiências na Região' },
        { titulo: 'Experiências na região' },
        { titulo: 'Galeria' },
        { titulo: 'Termos' },
        { titulo: '' },
      ],
    })
    expect(s.paginas_proprias?.map(p => p.slug)).toEqual([
      'experiencias-na-regiao', 'experiencias-na-regiao-2', 'galeria-1', 'termos-1',
    ])
  })

  it('o slug gravado manda sobre o título, para os links partilhados não partirem', () => {
    const s = normalizarSecoes({ paginas_proprias: [{ slug: 'como-chegar', titulo: 'Como chegar à casa' }] })
    expect(s.paginas_proprias?.[0].slug).toBe('como-chegar')
  })

  it('o menu só guarda páginas que existem, sem repetir', () => {
    const s = normalizarSecoes({ menu: ['sobre', 'sobre', 'p:fantasma', 'inventada', 'blog'] })
    expect(s.menu).toEqual(['sobre', 'blog'])
  })

  it('a imagem do topo tem de ser https e, quando há lista, uma das fotos permitidas', () => {
    expect(normalizarSecoes({ hero_imagem: 'javascript:alert(1)' }).hero_imagem).toBeUndefined()
    expect(normalizarSecoes({ hero_imagem: 'http://x/a.jpg' }).hero_imagem).toBeUndefined()
    expect(normalizarSecoes({ hero_imagem: 'https://x/a.jpg' }, new Set(['https://x/b.jpg'])).hero_imagem).toBeUndefined()
    expect(normalizarSecoes({ hero_imagem: 'https://x/b.jpg' }, new Set(['https://x/b.jpg'])).hero_imagem).toBe('https://x/b.jpg')
  })

  it('«porquê reservar direto» todo vazio é ausência, não três textos vazios', () => {
    expect(normalizarSecoes({ porque: [{ titulo: '', texto: '' }] }).porque).toBeUndefined()
  })

  it('slugDePagina', () => {
    expect(slugDePagina('  Regras da Casa — 2026! ')).toBe('regras-da-casa-2026')
    expect(slugDePagina('Ção')).toBe('cao')
  })
})

describe('mapa do site — fotografia carregada para o topo', () => {
  const url = 'https://abc123.public.blob.vercel-storage.com/propriedades/user_1/0f8e7d6c-1234-4abc-9def-0123456789ab.jpeg'
  it('só vale a do próprio anfitrião, no sítio onde o upload grava', async () => {
    const { eFotoCarregadaPor } = await import('./site-mapa')
    expect(eFotoCarregadaPor(url, 'user_1')).toBe(true)
    expect(eFotoCarregadaPor(url, 'user_2')).toBe(false)
    expect(eFotoCarregadaPor(url.replace('propriedades', 'outra'), 'user_1')).toBe(false)
    expect(eFotoCarregadaPor('https://evil.example/propriedades/user_1/a.jpeg', 'user_1')).toBe(false)
  })

  it('normalizarSecoes aceita um critério em vez de uma lista', () => {
    expect(normalizarSecoes({ hero_imagem: url }, u => u === url).hero_imagem).toBe(url)
    expect(normalizarSecoes({ hero_imagem: url }, () => false).hero_imagem).toBeUndefined()
  })
})
