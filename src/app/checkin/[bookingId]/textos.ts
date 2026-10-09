/**
 * Textos do check-in online, em português e inglês.
 *
 * O boletim do SIBA é sobre hóspedes estrangeiros: uma página só em português
 * pedia dados de documento a quem não a percebia. A língua inicial é a do
 * browser; há um botão para trocar.
 *
 * Os valores gravados não mudam com a língua (tipo de documento e sexo vão em
 * português, os países pelo nome em português) — só os rótulos.
 */

export type Lingua = 'pt' | 'en'

export function linguaDoBrowser(): Lingua {
  if (typeof navigator === 'undefined') return 'pt'
  return (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

const pt = {
  outraLingua: 'English',
  cabecalho: 'Check-in online',
  noitesCurto: (n: number) => `${n} ${n === 1 ? 'noite' : 'noites'}`,
  erroTitulo: 'Reserva não encontrada',
  erroTexto: 'Verifica o link enviado pelo teu anfitrião.',
  jaTitulo: 'Check-in já submetido',
  jaTexto: (casa: string) => `Os teus dados foram registados. Boa estadia em ${casa}!`,
  obrigado: (nome: string) => `Obrigado, ${nome}!`,
  enviados: (host: string) => `Os teus dados foram enviados para ${host}.`,
  resumo: (n: number, h: number) => `${n} ${n === 1 ? 'noite' : 'noites'} · ${h} ${h === 1 ? 'hóspede' : 'hóspedes'}`,
  confirmaEmBreve: 'O teu anfitrião irá confirmar os detalhes em breve.',
  ola: 'Olá! Faz o check-in online',
  introIA: 'Fotografa o teu documento de identificação e os dados serão preenchidos automaticamente. Demora menos de 1 minuto.',
  introManual: 'Preenche os dados do teu documento de identificação. Demora poucos minutos.',
  anfitriao: 'Anfitrião',
  fotografar: 'Fotografar documento',
  fotografarAjuda: 'Passaporte, CC ou BI',
  preencherManual: 'Preencher manualmente',
  preencherDados: 'Preencher os meus dados',
  aLer: 'A ler documento...',
  aExtrair: 'A extrair dados do documento...',
  trocarDoc: 'Trocar documento',
  naoLeu: 'Não foi possível ler o documento. Preenche os dados manualmente.',
  naoLeuCurto: 'Não foi possível ler. Preenche à mão.',
  osTeusDados: 'Os teus dados',
  selecionar: 'Selecionar...',
  campos: {
    nome: 'Nome completo',
    data_nascimento: 'Data de nascimento',
    nacionalidade: 'Nacionalidade',
    numero_documento: 'Nº do documento',
    tipo_documento: 'Tipo de documento',
    data_validade_doc: 'Validade do documento',
    sexo: 'Sexo',
    pais_emissao: 'País de emissão do documento',
    pais_residencia: 'País de residência',
    local_residencia: 'Localidade onde vives',
    email: 'Email',
    telefone: 'Telefone',
    nif: 'NIF (só se quiseres a fatura em teu nome)',
  },
  tiposDocumento: {
    'Passaporte': 'Passaporte',
    'Cartão de Cidadão': 'Cartão de Cidadão',
    'BI': 'BI',
    'Título de Residência': 'Título de Residência',
    'Outro': 'Outro',
  } as Record<string, string>,
  sexos: { M: 'Masculino', F: 'Feminino' } as Record<string, string>,
  quemVem: 'Quem vem contigo',
  quemVemTexto: 'A lei pede um boletim de alojamento por pessoa. Preenche os dados de cada acompanhante — se não souberes algum agora, o anfitrião pode completar depois.',
  acompanhante: (i: number) => `Acompanhante ${i}`,
  remover: 'Remover',
  acrescentar: '+ Acrescentar pessoa',
  confirmar: 'Confirmar check-in',
  falta: (campos: string[]) => `Falta preencher: ${campos.join(', ')}.`,
  privacidade: 'Os teus dados são usados exclusivamente para cumprimento do registo obrigatório de hóspedes (boletim de alojamento, SIBA/AIMA).',
  aGuardar: 'A guardar os teus dados...',
  erroGuardar: 'Erro ao guardar. Tenta novamente.',
  semLigacao: 'Sem ligação. Verifica a internet e tenta novamente.',
}

export type Textos = typeof pt

const en: Textos = {
  outraLingua: 'Português',
  cabecalho: 'Online check-in',
  noitesCurto: n => `${n} ${n === 1 ? 'night' : 'nights'}`,
  erroTitulo: 'Booking not found',
  erroTexto: 'Please check the link your host sent you.',
  jaTitulo: 'Check-in already submitted',
  jaTexto: casa => `Your details have been recorded. Enjoy your stay at ${casa}!`,
  obrigado: nome => `Thank you, ${nome}!`,
  enviados: host => `Your details have been sent to ${host}.`,
  resumo: (n, h) => `${n} ${n === 1 ? 'night' : 'nights'} · ${h} ${h === 1 ? 'guest' : 'guests'}`,
  confirmaEmBreve: 'Your host will confirm the details shortly.',
  ola: 'Hi! Complete your online check-in',
  introIA: 'Take a photo of your ID and the form fills itself in. It takes less than a minute.',
  introManual: 'Enter the details from your passport or ID card. It only takes a few minutes.',
  anfitriao: 'Host',
  fotografar: 'Photograph your ID',
  fotografarAjuda: 'Passport or ID card',
  preencherManual: 'Fill in manually',
  preencherDados: 'Fill in my details',
  aLer: 'Reading document...',
  aExtrair: 'Reading the details from your document...',
  trocarDoc: 'Change document',
  naoLeu: 'We could not read the document. Please fill in the details manually.',
  naoLeuCurto: 'Could not read it. Please fill in manually.',
  osTeusDados: 'Your details',
  selecionar: 'Select...',
  campos: {
    nome: 'Full name',
    data_nascimento: 'Date of birth',
    nacionalidade: 'Nationality',
    numero_documento: 'Document number',
    tipo_documento: 'Document type',
    data_validade_doc: 'Document expiry date',
    sexo: 'Sex',
    pais_emissao: 'Document issuing country',
    pais_residencia: 'Country of residence',
    local_residencia: 'City of residence',
    email: 'Email',
    telefone: 'Phone',
    nif: 'Portuguese tax number (NIF) — only if you need an invoice in your name',
  },
  tiposDocumento: {
    'Passaporte': 'Passport',
    'Cartão de Cidadão': 'National ID card',
    'BI': 'Identity card (BI)',
    'Título de Residência': 'Residence permit',
    'Outro': 'Other',
  },
  sexos: { M: 'Male', F: 'Female' },
  quemVem: 'Who is travelling with you',
  quemVemTexto: 'Portuguese law requires a guest registration form for each person. Please fill in the details for everyone — if you don’t know something now, your host can complete it later.',
  acompanhante: i => `Guest ${i}`,
  remover: 'Remove',
  acrescentar: '+ Add person',
  confirmar: 'Confirm check-in',
  falta: campos => `Still missing: ${campos.join(', ')}.`,
  privacidade: 'Your details are used only for the mandatory guest registration required by Portuguese law (SIBA/AIMA).',
  aGuardar: 'Saving your details...',
  erroGuardar: 'Could not save. Please try again.',
  semLigacao: 'No connection. Check your internet and try again.',
}

export const TEXTOS: Record<Lingua, Textos> = { pt, en }
