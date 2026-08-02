import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { submeterBoletins, explicarFalha } = await import('./siba-api')

const UNIDADE = {
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

const BOLETIM = {
  apelido: 'Silva',
  nome: 'Maria',
  nacionalidade: 'PRT',
  dataNascimento: '1985-03-14',
  documentoIdentificacao: 'CC12345678',
  paisEmissorDocumento: 'PRT',
  tipoDocumento: 'B' as const,
  dataEntrada: '2026-08-10',
  dataSaida: '2026-08-14',
  paisResidenciaOrigem: 'PRT',
  localResidenciaOrigem: 'Lisboa',
}

const ARGS = {
  unidade: UNIDADE,
  chaveAcesso: '987654321',
  boletins: [BOLETIM],
  numeroFicheiro: 1,
  dataMovimento: '2026-08-02',
}

function respostaSoap(resultado: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    `<EntregaBoletinsAlojamentoResponse xmlns="http://sef.pt/"><EntregaBoletinsAlojamentoResult>${resultado}</EntregaBoletinsAlojamentoResult></EntregaBoletinsAlojamentoResponse>` +
    '</soap:Body></soap:Envelope>'
  )
}

const ok = () => new Response(respostaSoap('0'), { status: 200 })

describe('submeterBoletins', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  /** Corre a promessa deixando os temporizadores do recuo avançarem sozinhos. */
  async function correr<T>(p: Promise<T>): Promise<T> {
    const resultado = p.then(v => v)
    await vi.runAllTimersAsync()
    return resultado
  }

  it('devolve sucesso quando o SIBA aceita', async () => {
    vi.mocked(fetch).mockResolvedValue(ok())
    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(true)
    expect(r.tentativas).toBe(1)
  })

  it('chama o endereço de produção com o SOAPAction certo', async () => {
    vi.mocked(fetch).mockResolvedValue(ok())
    await correr(submeterBoletins(ARGS))

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx')
    expect((init?.headers as Record<string, string>).SOAPAction).toBe(
      'http://sef.pt/EntregaBoletinsAlojamento',
    )
    expect((init?.headers as Record<string, string>)['Content-Type']).toContain('text/xml')
    expect(String(init?.body)).toContain('<ChaveAcesso>987654321</ChaveAcesso>')
  })

  it('respeita SIBA_WS_URL para apontar ao ambiente de testes', async () => {
    vi.stubEnv('SIBA_WS_URL', 'https://siba.ssi.gov.pt/bawsdev/boletinsalojamento.asmx')
    vi.mocked(fetch).mockResolvedValue(ok())
    await correr(submeterBoletins(ARGS))
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/bawsdev/')
  })

  it('devolve sempre a impressão digital do que enviou, mesmo em falha', async () => {
    vi.mocked(fetch).mockResolvedValue(ok())
    const bom = await correr(submeterBoletins(ARGS))

    vi.mocked(fetch).mockRejectedValue(new Error('sem rede'))
    const mau = await correr(submeterBoletins(ARGS))

    expect(bom.hashEnvio).toMatch(/^[a-f0-9]{64}$/)
    // O conteúdo é o mesmo, logo a prova é a mesma — é uma função do envio.
    expect(mau.hashEnvio).toBe(bom.hashEnvio)
  })

  it('a impressão digital muda quando os dados mudam', async () => {
    vi.mocked(fetch).mockResolvedValue(ok())
    const a = await correr(submeterBoletins(ARGS))
    const b = await correr(submeterBoletins({
      ...ARGS,
      boletins: [{ ...BOLETIM, documentoIdentificacao: 'OUTRO' }],
    }))
    expect(a.hashEnvio).not.toBe(b.hashEnvio)
  })

  it('repete quando o serviço devolve 503', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('<html>503</html>', { status: 503 }))
      .mockResolvedValueOnce(ok())

    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(true)
    expect(r.tentativas).toBe(2)
  })

  it('repete quando vem HTML em vez de SOAP', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('<html>manutenção</html>', { status: 200 }))
      .mockResolvedValueOnce(ok())

    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(true)
  })

  it('repete quando a rede falha', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok())

    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(true)
  })

  it('desiste ao fim de três tentativas', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('sem rede'))
    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(false)
    expect(r.tentativas).toBe(3)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('não repete quando o SIBA recusa os dados — repetir daria o mesmo erro', async () => {
    const erro =
      '&lt;ErrosBA&gt;&lt;RetornoBA&gt;&lt;Codigo_Retorno&gt;25&lt;/Codigo_Retorno&gt;' +
      '&lt;Linha&gt;1&lt;/Linha&gt;&lt;Descricao&gt;Documento inválido&lt;/Descricao&gt;' +
      '&lt;/RetornoBA&gt;&lt;/ErrosBA&gt;'
    vi.mocked(fetch).mockResolvedValue(new Response(respostaSoap(erro), { status: 200 }))

    const r = await correr(submeterBoletins(ARGS))
    expect(r.sucesso).toBe(false)
    expect(r.codigo).toBe('25')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('guarda a resposta em bruto para prova', async () => {
    vi.mocked(fetch).mockResolvedValue(ok())
    const r = await correr(submeterBoletins(ARGS))
    expect(r.respostaBruta).toContain('EntregaBoletinsAlojamentoResult')
  })
})

describe('explicarFalha', () => {
  it('distingue indisponibilidade de erro de dados', () => {
    expect(explicarFalha({ sucesso: false, codigo: 'erro_rede' })).toContain('não respondeu')
    expect(explicarFalha({ sucesso: false, codigo: 'resposta_invalida' })).toContain('não respondeu')
  })

  it('usa a descrição do SIBA e diz de que hóspede se trata', () => {
    expect(
      explicarFalha({ sucesso: false, codigo: '25', linha: '2', mensagem: 'Documento inválido' }),
    ).toBe('Documento inválido (hóspede 2)')
  })

  it('não deixa o anfitrião sem mensagem quando o SIBA não a dá', () => {
    expect(explicarFalha({ sucesso: false, codigo: '99' })).toContain('código 99')
  })
})
