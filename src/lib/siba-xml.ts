/**
 * Geração e leitura do formato SIBA (Sistema de Informação de Boletins de
 * Alojamento) — lógica pura, sem rede e sem base de dados, para poder ser
 * testada até ao último campo. A chamada HTTP vive em `siba-api.ts`.
 *
 * ## Porque é que isto existe agora
 *
 * O `siba-api.ts` era um placeholder que devolvia 501, com a nota de que
 * faltava "documentação técnica da AIMA". Não falta: o serviço é público e
 * está documentado.
 *
 * - WSDL: `https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx?WSDL`
 * - Método: `EntregaBoletinsAlojamento` (SOAP 1.1/1.2, `style="document"`,
 *   `soapAction="http://sef.pt/EntregaBoletinsAlojamento"`)
 * - Parâmetros: `UnidadeHoteleira` (NIPC), `Estabelecimento` (int),
 *   `ChaveAcesso`, `Boletins` (o XML abaixo, em Base64)
 * - Resposta: `EntregaBoletinsAlojamentoResult`, string. `"0"` é sucesso;
 *   qualquer outra coisa é um XML `ErrosBA/RetornoBA` com `Codigo_Retorno`,
 *   `Linha` e `Descricao`.
 *
 * As credenciais são **do anfitrião, por estabelecimento**, não da plataforma:
 * regista-se a unidade na área reservada do portal SIBA escolhendo o modo de
 * envio "Web Service" e recebe-se por email o número de estabelecimento e a
 * chave de acesso. É por isso que nada aqui lê variáveis de ambiente — as
 * credenciais chegam por argumento, vindas da propriedade.
 *
 * Estrutura confirmada contra a implementação de referência
 * `rafaelrpinto/node-siba`, que corre contra este mesmo serviço.
 */

/** Unidade hoteleira — o alojamento registado no SIBA. */
export interface UnidadeHoteleira {
  /** NIPC/NIF, 9 dígitos. Vai também no parâmetro SOAP `UnidadeHoteleira`. */
  nipc: string
  /** Número do estabelecimento atribuído pelo SEF/AIMA. O primeiro de um NIPC é "00". */
  estabelecimento: string
  nome: string
  /** Abreviatura do nome da unidade (o portal impõe-a no registo). */
  abreviatura: string
  morada: string
  localidade: string
  /** CP4 — os primeiros 4 dígitos do código postal. */
  codigoPostal: string
  /** CP3 — os 3 dígitos depois do hífen. */
  zonaPostal: string
  telefone: string
  nomeContacto: string
  emailContacto: string
  fax?: string
}

/** Tipos de documento aceites pelo SIBA. */
export type TipoDocumentoSiba = 'P' | 'B' | 'O'

/** Um boletim — um hóspede, uma estadia. */
export interface BoletimHospede {
  apelido: string
  nome: string
  /** Código de país de 3 letras (tabela do SEF, base ISO 3166-1 alfa-3). */
  nacionalidade: string
  /** YYYY-MM-DD */
  dataNascimento: string
  localNascimento?: string
  documentoIdentificacao: string
  paisEmissorDocumento: string
  tipoDocumento: TipoDocumentoSiba
  /** YYYY-MM-DD */
  dataEntrada: string
  /** YYYY-MM-DD */
  dataSaida?: string
  paisResidenciaOrigem: string
  /** Facultativo, segundo as perguntas técnicas do SIBA. */
  localResidenciaOrigem?: string
}

export interface RespostaSiba {
  sucesso: boolean
  codigo: string
  /** Linha do ficheiro onde o erro ocorreu, quando o SIBA a indica. */
  linha?: string
  mensagem?: string
}

/** Escapa texto para conteúdo XML. */
export function escaparXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Converte uma data YYYY-MM-DD no timestamp ISO que o SIBA espera.
 *
 * Fixa-se meio-dia UTC de propósito: à meia-noite, qualquer conversão de fuso
 * do lado de lá faz a data saltar um dia — que é exatamente a classe de bug
 * que já mordeu este projeto uma vez.
 */
export function dataSiba(iso: string): string {
  return `${iso}T12:00:00.000Z`
}

/**
 * Separa "Maria Silva Costa" em nome próprio e apelido.
 *
 * O SIBA exige os dois campos. Quando só há uma palavra, a referência manda
 * pô-la no apelido e deixar o nome com um espaço — um campo vazio é recusado.
 */
export function separarNome(nomeCompleto: string): { nome: string; apelido: string } {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { nome: ' ', apelido: '' }
  if (partes.length === 1) return { nome: ' ', apelido: partes[0] }
  return { nome: partes.slice(0, -1).join(' '), apelido: partes[partes.length - 1] }
}

/** Separa "4050-175" (ou "4050175", ou "4050") em CP4 e CP3. */
export function separarCodigoPostal(cp: string | null | undefined): { codigoPostal: string; zonaPostal: string } {
  const digitos = String(cp ?? '').replace(/\D/g, '')
  return { codigoPostal: digitos.slice(0, 4), zonaPostal: digitos.slice(4, 7) }
}

/**
 * Normaliza o tipo de documento que a app recolhe (texto livre, vindo do
 * formulário de check-in ou do OCR) para o código de uma letra do SIBA.
 */
export function normalizarTipoDocumento(v: string | null | undefined): TipoDocumentoSiba | undefined {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return undefined
  if (s === 'p' || s.includes('passaporte') || s.includes('passport')) return 'P'
  if (
    s === 'b' ||
    s.includes('cartão de cidadão') || s.includes('cartao de cidadao') ||
    s.includes('bilhete') || s.includes('identity') || s.includes('id card') ||
    s === 'cc' || s === 'bi' || s === 'dni'
  ) return 'B'
  return 'O'
}

/**
 * Nacionalidades e países como a app os guarda (nome em português, vindo do
 * OCR) → código de 3 letras.
 *
 * Cobre os mercados emissores que representam a esmagadora maioria das
 * dormidas em Portugal. O que não estiver aqui **não é adivinhado**: a
 * validação recusa o boletim e pede o código, porque um código errado é
 * recusado pelo SIBA na mesma e sem explicação útil.
 */
const PAISES: Record<string, string> = {
  'portugal': 'PRT',
  'espanha': 'ESP',
  'franca': 'FRA', 'frança': 'FRA',
  'alemanha': 'DEU',
  'reino unido': 'GBR', 'inglaterra': 'GBR', 'gra-bretanha': 'GBR', 'grã-bretanha': 'GBR',
  'irlanda': 'IRL',
  'italia': 'ITA', 'itália': 'ITA',
  'paises baixos': 'NLD', 'países baixos': 'NLD', 'holanda': 'NLD',
  'belgica': 'BEL', 'bélgica': 'BEL',
  'suica': 'CHE', 'suíça': 'CHE',
  'austria': 'AUT', 'áustria': 'AUT',
  'polonia': 'POL', 'polónia': 'POL',
  'suecia': 'SWE', 'suécia': 'SWE',
  'noruega': 'NOR',
  'dinamarca': 'DNK',
  'finlandia': 'FIN', 'finlândia': 'FIN',
  'republica checa': 'CZE', 'república checa': 'CZE', 'chequia': 'CZE',
  'hungria': 'HUN',
  'roménia': 'ROU', 'romenia': 'ROU',
  'grecia': 'GRC', 'grécia': 'GRC',
  'luxemburgo': 'LUX',
  'estados unidos': 'USA', 'eua': 'USA', 'estados unidos da america': 'USA', 'estados unidos da américa': 'USA',
  'canada': 'CAN', 'canadá': 'CAN',
  'brasil': 'BRA',
  'mexico': 'MEX', 'méxico': 'MEX',
  'argentina': 'ARG',
  'chile': 'CHL',
  'colombia': 'COL', 'colômbia': 'COL',
  'australia': 'AUS', 'austrália': 'AUS',
  'nova zelandia': 'NZL', 'nova zelândia': 'NZL',
  'japao': 'JPN', 'japão': 'JPN',
  'china': 'CHN',
  'coreia do sul': 'KOR',
  'india': 'IND', 'índia': 'IND',
  'israel': 'ISR',
  'turquia': 'TUR',
  'russia': 'RUS', 'rússia': 'RUS',
  'ucrania': 'UKR', 'ucrânia': 'UKR',
  'africa do sul': 'ZAF', 'áfrica do sul': 'ZAF',
  'angola': 'AGO',
  'mocambique': 'MOZ', 'moçambique': 'MOZ',
  'cabo verde': 'CPV',
  'marrocos': 'MAR',
}

/**
 * Converte um nome de país em português no código de 3 letras. Aceita já um
 * código de 3 letras (passa através). Devolve `undefined` quando não sabe —
 * nunca adivinha.
 */
export function codigoPais(v: string | null | undefined): string | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase()
  return PAISES[s.toLowerCase()]
}

/**
 * Verifica se um boletim tem tudo o que o SIBA exige.
 *
 * Vale a pena falhar aqui e não lá: o serviço responde com códigos numéricos
 * e a descrição do erro é seca. Uma lista de campos em falta, em português, é
 * a diferença entre "corrige o número do documento da Maria" e "erro 25".
 */
export function camposEmFalta(b: Partial<BoletimHospede>): string[] {
  const falta: string[] = []
  if (!b.apelido?.trim()) falta.push('apelido')
  if (!b.nacionalidade) falta.push('nacionalidade')
  if (!b.dataNascimento) falta.push('data de nascimento')
  if (!b.documentoIdentificacao?.trim()) falta.push('número do documento')
  if (!b.tipoDocumento) falta.push('tipo de documento')
  if (!b.paisEmissorDocumento) falta.push('país emissor do documento')
  if (!b.dataEntrada) falta.push('data de entrada')
  if (!b.paisResidenciaOrigem) falta.push('país de residência')
  return falta
}

function elemento(nome: string, valor: string | number | undefined): string {
  if (valor === undefined || valor === '') return ''
  return `<${nome}>${escaparXml(String(valor))}</${nome}>`
}

/**
 * Constrói o XML `MovimentoBAL` — o conteúdo que vai em Base64 no parâmetro
 * `Boletins`.
 */
export function construirMovimentoBal(
  unidade: UnidadeHoteleira,
  boletins: BoletimHospede[],
  envio: { numeroFicheiro: number; dataMovimento: string },
): string {
  const unidadeXml = [
    elemento('Codigo_Unidade_Hoteleira', unidade.nipc),
    elemento('Estabelecimento', unidade.estabelecimento),
    elemento('Nome', unidade.nome),
    elemento('Abreviatura', unidade.abreviatura),
    elemento('Morada', unidade.morada),
    elemento('Localidade', unidade.localidade),
    elemento('Codigo_Postal', unidade.codigoPostal),
    elemento('Zona_Postal', unidade.zonaPostal),
    elemento('Telefone', unidade.telefone),
    elemento('Fax', unidade.fax),
    elemento('Nome_Contacto', unidade.nomeContacto),
    elemento('Email_Contacto', unidade.emailContacto),
  ].join('')

  const boletinsXml = boletins.map(b => [
    elemento('Apelido', b.apelido),
    elemento('Nome', b.nome),
    elemento('Nacionalidade', b.nacionalidade),
    elemento('Data_Nascimento', dataSiba(b.dataNascimento)),
    elemento('Local_Nascimento', b.localNascimento),
    elemento('Documento_Identificacao', b.documentoIdentificacao),
    elemento('Pais_Emissor_Documento', b.paisEmissorDocumento),
    elemento('Tipo_Documento', b.tipoDocumento),
    elemento('Data_Entrada', dataSiba(b.dataEntrada)),
    b.dataSaida ? elemento('Data_Saida', dataSiba(b.dataSaida)) : '',
    elemento('Pais_Residencia_Origem', b.paisResidenciaOrigem),
    elemento('Local_Residencia_Origem', b.localResidenciaOrigem),
  ].join('')).map(x => `<Boletim_Alojamento>${x}</Boletim_Alojamento>`).join('')

  const envioXml =
    elemento('Numero_Ficheiro', envio.numeroFicheiro) +
    elemento('Data_Movimento', dataSiba(envio.dataMovimento))

  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<MovimentoBAL xmlns="http://sef.pt/BAws">' +
    `<Unidade_Hoteleira>${unidadeXml}</Unidade_Hoteleira>` +
    boletinsXml +
    `<Envio>${envioXml}</Envio>` +
    '</MovimentoBAL>'
  )
}

/** Constrói o envelope SOAP 1.1 do `EntregaBoletinsAlojamento`. */
export function construirEnvelopeSoap(args: {
  nipc: string
  estabelecimento: string
  chaveAcesso: string
  movimentoBalXml: string
}): string {
  const boletinsBase64 = Buffer.from(args.movimentoBalXml, 'utf-8').toString('base64')

  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body>' +
    '<EntregaBoletinsAlojamento xmlns="http://sef.pt/">' +
    elemento('UnidadeHoteleira', args.nipc) +
    elemento('Estabelecimento', args.estabelecimento) +
    elemento('ChaveAcesso', args.chaveAcesso) +
    `<Boletins>${boletinsBase64}</Boletins>` +
    '</EntregaBoletinsAlojamento>' +
    '</soap:Body>' +
    '</soap:Envelope>'
  )
}

/** Extrai o conteúdo do primeiro elemento com este nome, ignorando prefixos. */
function extrair(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:[\\w.-]+:)?${nome}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${nome}>`, 'i'))
  return m?.[1]
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Interpreta a resposta SOAP.
 *
 * O resultado é uma string: `"0"` significa que todos os boletins foram
 * aceites. Qualquer outra coisa é um XML de erros — que vem escapado dentro
 * do elemento de resultado, e por isso tem de ser desescapado antes de lido.
 */
export function interpretarRespostaSiba(xml: string): RespostaSiba {
  const resultado = extrair(xml, 'EntregaBoletinsAlojamentoResult')

  if (resultado === undefined) {
    // Serviço em baixo devolve HTML em vez de SOAP — acontece, e não é nosso.
    return {
      sucesso: false,
      codigo: 'resposta_invalida',
      mensagem: 'O SIBA respondeu num formato inesperado. Costuma ser indisponibilidade temporária do serviço.',
    }
  }

  const texto = desescapar(resultado.trim())
  if (texto === '0') return { sucesso: true, codigo: '0' }

  return {
    sucesso: false,
    codigo: extrair(texto, 'Codigo_Retorno')?.trim() || 'desconhecido',
    linha: extrair(texto, 'Linha')?.trim(),
    mensagem: extrair(texto, 'Descricao')?.trim() || texto.slice(0, 300),
  }
}
