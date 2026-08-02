import { describe, it, expect } from 'vitest'
import {
  escaparXml,
  dataSiba,
  separarNome,
  separarCodigoPostal,
  normalizarTipoDocumento,
  codigoPais,
  camposEmFalta,
  construirMovimentoBal,
  construirEnvelopeSoap,
  interpretarRespostaSiba,
  type UnidadeHoteleira,
  type BoletimHospede,
} from './siba-xml'

const UNIDADE: UnidadeHoteleira = {
  nipc: '123456789',
  estabelecimento: '00',
  nome: 'Casa do Vale',
  abreviatura: 'CDV',
  morada: 'Rua das Flores 12',
  localidade: 'Porto',
  codigoPostal: '4050',
  zonaPostal: '175',
  telefone: '912345678',
  nomeContacto: 'Vasco Henriques',
  emailContacto: 'suporte@anfitrioes.pt',
}

const BOLETIM: BoletimHospede = {
  apelido: 'Silva',
  nome: 'Maria',
  nacionalidade: 'PRT',
  dataNascimento: '1985-03-14',
  localNascimento: 'Braga',
  documentoIdentificacao: 'CC12345678',
  paisEmissorDocumento: 'PRT',
  tipoDocumento: 'B',
  dataEntrada: '2026-08-10',
  dataSaida: '2026-08-14',
  paisResidenciaOrigem: 'PRT',
  localResidenciaOrigem: 'Lisboa',
}

describe('escaparXml', () => {
  it('escapa os cinco caracteres que quebram XML', () => {
    expect(escaparXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('impede injeção de elementos por um nome de hóspede', () => {
    const xml = construirMovimentoBal(
      UNIDADE,
      [{ ...BOLETIM, apelido: '</Apelido><Injetado>x</Injetado><Apelido>' }],
      { numeroFicheiro: 1, dataMovimento: '2026-08-02' },
    )
    expect(xml).not.toContain('<Injetado>')
    expect(xml).toContain('&lt;/Apelido&gt;')
  })
})

describe('dataSiba', () => {
  it('usa meio-dia UTC para a data não saltar com o fuso', () => {
    expect(dataSiba('2026-08-10')).toBe('2026-08-10T12:00:00.000Z')
  })

  it('mantém o dia em qualquer fuso ao ser reinterpretada', () => {
    // Um timestamp à meia-noite UTC cairia no dia anterior a oeste de Greenwich.
    const d = new Date(dataSiba('2026-08-10'))
    expect(d.getUTCDate()).toBe(10)
    expect(new Date(d.getTime() - 11 * 3600_000).getUTCDate()).toBe(10)
    expect(new Date(d.getTime() + 11 * 3600_000).getUTCDate()).toBe(10)
  })
})

describe('separarNome', () => {
  it('separa o último termo como apelido', () => {
    expect(separarNome('Maria Silva')).toEqual({ nome: 'Maria', apelido: 'Silva' })
  })

  it('junta os nomes do meio ao nome próprio', () => {
    expect(separarNome('Maria Isabel Silva Costa')).toEqual({
      nome: 'Maria Isabel Silva',
      apelido: 'Costa',
    })
  })

  it('com um só nome põe-no no apelido e deixa o nome com um espaço', () => {
    // O SIBA recusa o campo vazio; a referência usa um espaço.
    expect(separarNome('Madonna')).toEqual({ nome: ' ', apelido: 'Madonna' })
  })

  it('tolera espaços a mais', () => {
    expect(separarNome('  Ana   Lopes  ')).toEqual({ nome: 'Ana', apelido: 'Lopes' })
  })

  it('não rebenta com string vazia', () => {
    expect(separarNome('   ')).toEqual({ nome: ' ', apelido: '' })
  })
})

describe('separarCodigoPostal', () => {
  it('separa CP4 e CP3', () => {
    expect(separarCodigoPostal('4050-175')).toEqual({ codigoPostal: '4050', zonaPostal: '175' })
  })

  it('aceita sem hífen e com espaços', () => {
    expect(separarCodigoPostal(' 4050 175 ')).toEqual({ codigoPostal: '4050', zonaPostal: '175' })
  })

  it('devolve zona vazia quando só há CP4', () => {
    expect(separarCodigoPostal('4050')).toEqual({ codigoPostal: '4050', zonaPostal: '' })
  })

  it('não rebenta com nulo', () => {
    expect(separarCodigoPostal(null)).toEqual({ codigoPostal: '', zonaPostal: '' })
  })
})

describe('normalizarTipoDocumento', () => {
  it.each([
    ['Passaporte', 'P'],
    ['passport', 'P'],
    ['P', 'P'],
    ['Cartão de Cidadão', 'B'],
    ['cartao de cidadao', 'B'],
    ['Bilhete de Identidade', 'B'],
    ['CC', 'B'],
    ['DNI', 'B'],
    ['ID Card', 'B'],
    ['Título de residência', 'O'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTipoDocumento(entrada)).toBe(esperado)
  })

  it('devolve undefined quando não há valor', () => {
    expect(normalizarTipoDocumento('')).toBeUndefined()
    expect(normalizarTipoDocumento(null)).toBeUndefined()
  })
})

describe('codigoPais', () => {
  it('converte nomes em português', () => {
    expect(codigoPais('Portugal')).toBe('PRT')
    expect(codigoPais('Alemanha')).toBe('DEU')
    expect(codigoPais('reino unido')).toBe('GBR')
  })

  it('aceita nomes com e sem acento', () => {
    expect(codigoPais('França')).toBe('FRA')
    expect(codigoPais('Franca')).toBe('FRA')
  })

  it('deixa passar um código de 3 letras', () => {
    expect(codigoPais('bra')).toBe('BRA')
  })

  it('não adivinha o que não conhece', () => {
    expect(codigoPais('Nárnia')).toBeUndefined()
    expect(codigoPais('')).toBeUndefined()
  })
})

describe('camposEmFalta', () => {
  it('não acusa nada num boletim completo', () => {
    expect(camposEmFalta(BOLETIM)).toEqual([])
  })

  it('lista o que falta, em português', () => {
    const falta = camposEmFalta({ ...BOLETIM, documentoIdentificacao: '', nacionalidade: '' })
    expect(falta).toContain('número do documento')
    expect(falta).toContain('nacionalidade')
  })

  it('exige o país de residência mas não a localidade', () => {
    // As perguntas técnicas do SIBA dão o local de residência como facultativo.
    expect(camposEmFalta({ ...BOLETIM, localResidenciaOrigem: '' })).toEqual([])
    expect(camposEmFalta({ ...BOLETIM, paisResidenciaOrigem: '' })).toContain('país de residência')
  })

  it('a data de saída é opcional', () => {
    const { dataSaida: _ignorado, ...semSaida } = BOLETIM
    expect(camposEmFalta(semSaida)).toEqual([])
  })

  it('o local de nascimento é opcional', () => {
    const { localNascimento: _ignorado, ...semLocal } = BOLETIM
    expect(camposEmFalta(semLocal)).toEqual([])
  })
})

describe('construirMovimentoBal', () => {
  const xml = construirMovimentoBal(UNIDADE, [BOLETIM], {
    numeroFicheiro: 7,
    dataMovimento: '2026-08-02',
  })

  it('declara o namespace do SEF', () => {
    expect(xml).toContain('<MovimentoBAL xmlns="http://sef.pt/BAws">')
  })

  it('inclui a unidade hoteleira com CP4 e CP3 separados', () => {
    expect(xml).toContain('<Codigo_Unidade_Hoteleira>123456789</Codigo_Unidade_Hoteleira>')
    expect(xml).toContain('<Estabelecimento>00</Estabelecimento>')
    expect(xml).toContain('<Codigo_Postal>4050</Codigo_Postal>')
    expect(xml).toContain('<Zona_Postal>175</Zona_Postal>')
  })

  it('omite o fax quando não existe', () => {
    expect(xml).not.toContain('<Fax>')
  })

  it('escreve um Boletim_Alojamento por hóspede', () => {
    const dois = construirMovimentoBal(UNIDADE, [BOLETIM, { ...BOLETIM, apelido: 'Costa' }], {
      numeroFicheiro: 1,
      dataMovimento: '2026-08-02',
    })
    expect(dois.match(/<Boletim_Alojamento>/g)).toHaveLength(2)
  })

  it('converte as datas para o formato do SIBA', () => {
    expect(xml).toContain('<Data_Entrada>2026-08-10T12:00:00.000Z</Data_Entrada>')
    expect(xml).toContain('<Data_Saida>2026-08-14T12:00:00.000Z</Data_Saida>')
    expect(xml).toContain('<Data_Nascimento>1985-03-14T12:00:00.000Z</Data_Nascimento>')
  })

  it('omite a data de saída quando a estadia ainda não terminou', () => {
    const { dataSaida: _ignorado, ...semSaida } = BOLETIM
    const aberto = construirMovimentoBal(UNIDADE, [semSaida], {
      numeroFicheiro: 1,
      dataMovimento: '2026-08-02',
    })
    expect(aberto).not.toContain('<Data_Saida>')
  })

  it('fecha com o bloco de envio', () => {
    expect(xml).toContain('<Envio><Numero_Ficheiro>7</Numero_Ficheiro>')
    expect(xml.endsWith('</Envio></MovimentoBAL>')).toBe(true)
  })
})

describe('construirEnvelopeSoap', () => {
  const movimento = construirMovimentoBal(UNIDADE, [BOLETIM], {
    numeroFicheiro: 1,
    dataMovimento: '2026-08-02',
  })
  const envelope = construirEnvelopeSoap({
    nipc: '123456789',
    estabelecimento: '00',
    chaveAcesso: '987654321',
    movimentoBalXml: movimento,
  })

  it('usa o namespace do método', () => {
    expect(envelope).toContain('<EntregaBoletinsAlojamento xmlns="http://sef.pt/">')
  })

  it('leva os quatro parâmetros do WSDL', () => {
    expect(envelope).toContain('<UnidadeHoteleira>123456789</UnidadeHoteleira>')
    expect(envelope).toContain('<Estabelecimento>00</Estabelecimento>')
    expect(envelope).toContain('<ChaveAcesso>987654321</ChaveAcesso>')
    expect(envelope).toContain('<Boletins>')
  })

  it('envia os boletins em Base64, e o que lá vai é o XML original', () => {
    const base64 = envelope.match(/<Boletins>([^<]+)<\/Boletins>/)?.[1] ?? ''
    expect(base64).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(Buffer.from(base64, 'base64').toString('utf-8')).toBe(movimento)
  })

  it('não deixa a chave de acesso escapar para fora do seu elemento', () => {
    const comAspas = construirEnvelopeSoap({
      nipc: '1', estabelecimento: '00', chaveAcesso: '<x>&"', movimentoBalXml: movimento,
    })
    expect(comAspas).toContain('<ChaveAcesso>&lt;x&gt;&amp;&quot;</ChaveAcesso>')
  })
})

describe('interpretarRespostaSiba', () => {
  const envolver = (resultado: string) =>
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    `<EntregaBoletinsAlojamentoResponse xmlns="http://sef.pt/"><EntregaBoletinsAlojamentoResult>${resultado}</EntregaBoletinsAlojamentoResult></EntregaBoletinsAlojamentoResponse>` +
    '</soap:Body></soap:Envelope>'

  it('lê "0" como sucesso', () => {
    expect(interpretarRespostaSiba(envolver('0'))).toEqual({ sucesso: true, codigo: '0' })
  })

  it('tolera espaços à volta do resultado', () => {
    expect(interpretarRespostaSiba(envolver('\n  0  \n')).sucesso).toBe(true)
  })

  it('lê o erro que vem escapado dentro do resultado', () => {
    const erros =
      '&lt;ErrosBA&gt;&lt;RetornoBA&gt;' +
      '&lt;Codigo_Retorno&gt;25&lt;/Codigo_Retorno&gt;' +
      '&lt;Linha&gt;2&lt;/Linha&gt;' +
      '&lt;Descricao&gt;Documento de identificação inválido&lt;/Descricao&gt;' +
      '&lt;/RetornoBA&gt;&lt;/ErrosBA&gt;'
    expect(interpretarRespostaSiba(envolver(erros))).toEqual({
      sucesso: false,
      codigo: '25',
      linha: '2',
      mensagem: 'Documento de identificação inválido',
    })
  })

  it('lê a resposta mesmo com prefixos de namespace diferentes', () => {
    const xml =
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
      '<EntregaBoletinsAlojamentoResult>0</EntregaBoletinsAlojamentoResult>' +
      '</s:Body></s:Envelope>'
    expect(interpretarRespostaSiba(xml).sucesso).toBe(true)
  })

  it('não explode quando o serviço devolve HTML em vez de SOAP', () => {
    const r = interpretarRespostaSiba('<html><body>503 Service Unavailable</body></html>')
    expect(r.sucesso).toBe(false)
    expect(r.codigo).toBe('resposta_invalida')
    expect(r.mensagem).toContain('indisponibilidade')
  })
})
