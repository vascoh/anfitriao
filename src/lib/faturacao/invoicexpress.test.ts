import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { InvoiceXpressAdapter, subdominioDe } = await import('./invoicexpress')

const CREDENCIAIS = { conta: 'casadevasco', apiKey: 'chave-da-conta' }

const PEDIDO = {
  tipo: 'invoice_receipt' as const,
  cliente: { nome: 'Maria Silva', email: 'maria@exemplo.pt', nif: '123456789' },
  linhas: [
    { nome: 'Alojamento', descricao: '3 noites', precoUnitario: 100, quantidade: 1, taxaIva: 6 },
    { nome: 'Taxa municipal turística', descricao: 'TMT', precoUnitario: 12, quantidade: 1, taxaIva: 0, motivoIsencao: 'M99' },
  ],
  data: '2026-08-04',
  referencia: 'b1',
}

function json(corpo: unknown, estado = 200) {
  return new Response(JSON.stringify(corpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  })
}

function corpoDe(chamada: number): Record<string, unknown> {
  return JSON.parse(String(vi.mocked(fetch).mock.calls[chamada][1]?.body))
}

function urlDe(chamada: number): string {
  return String(vi.mocked(fetch).mock.calls[chamada][0])
}

describe('InvoiceXpressAdapter', () => {
  let adaptador: InstanceType<typeof InvoiceXpressAdapter>

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    adaptador = new InvoiceXpressAdapter()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('emitir', () => {
    it('cria e finaliza o documento — sem finalizar não há fatura', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 42, status: 'draft' } }))
        .mockResolvedValueOnce(json({ invoice: { id: 42, status: 'finalized', sequence_number: 'FR 2026/1', atcud: 'ABC-1', total: 118 } }))

      const r = await adaptador.emitir(CREDENCIAIS, PEDIDO)

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
      expect(urlDe(0)).toContain('/invoice_receipts.json')
      expect(urlDe(1)).toContain('/invoice_receipts/42/change-state.json')
      expect(corpoDe(1)).toEqual({ invoice: { state: 'finalized' } })
      expect(r).toMatchObject({ sucesso: true, numero: 'FR 2026/1', atcud: 'ABC-1', total: 118 })
    })

    it('usa a conta e a chave que recebe, não variáveis de ambiente', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))

      await adaptador.emitir({ conta: 'outroanfitriao', apiKey: 'outra-chave' }, PEDIDO)

      expect(urlDe(0)).toContain('https://outroanfitriao.app.invoicexpress.com/')
      expect(urlDe(0)).toContain('api_key=outra-chave')
    })

    it('converte as datas para o formato português', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))

      await adaptador.emitir(CREDENCIAIS, PEDIDO)

      const invoice = corpoDe(0).invoice as Record<string, unknown>
      expect(invoice.date).toBe('04/08/2026')
    })

    it('nomeia os impostos como as contas portuguesas esperam', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))

      await adaptador.emitir(CREDENCIAIS, PEDIDO)

      const invoice = corpoDe(0).invoice as { items: Array<{ tax: { name: string } }> }
      // O InvoiceXpress escolhe o imposto pelo nome; um nome errado aplica o
      // imposto por omissão da conta sem avisar.
      expect(invoice.items[0].tax.name).toBe('IVA6')
      expect(invoice.items[1].tax.name).toBe('Isento')
    })

    it('leva o motivo de isenção para o documento', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))

      await adaptador.emitir(CREDENCIAIS, PEDIDO)

      const invoice = corpoDe(0).invoice as Record<string, unknown>
      expect(invoice.tax_exemption_reason).toBe('M99')
    })

    it('usa a série indicada', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 1 } }))

      await adaptador.emitir(CREDENCIAIS, { ...PEDIDO, serieId: '77' })

      const invoice = corpoDe(0).invoice as Record<string, unknown>
      expect(invoice.sequence_id).toBe(77)
    })

    it('envia por email quando pedido, depois de finalizar', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 7 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 7, sequence_number: 'FR 2026/2' } }))
        .mockResolvedValueOnce(json({ success: 'true' }))

      const r = await adaptador.emitir(CREDENCIAIS, { ...PEDIDO, enviarPorEmail: true })

      expect(urlDe(2)).toContain('/invoice_receipts/7/email-document.json')
      expect(r.sucesso).toBe(true)
    })

    it('um email falhado não invalida a fatura já emitida', async () => {
      const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 7 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 7, sequence_number: 'FR 2026/2' } }))
        .mockResolvedValueOnce(json({ errors: 'smtp down' }, 500))

      const r = await adaptador.emitir(CREDENCIAIS, { ...PEDIDO, enviarPorEmail: true })

      expect(r.sucesso).toBe(true)
      expect(r.numero).toBe('FR 2026/2')
      erro.mockRestore()
    })

    it('não finaliza nada quando a criação falha', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ errors: { error: 'Cliente inválido' } }, 422))

      const r = await adaptador.emitir(CREDENCIAIS, PEDIDO)

      expect(r.sucesso).toBe(false)
      expect(r.erro).toContain('422')
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    })

    it('falha com clareza se o serviço não devolver id', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ invoice: {} }))
      const r = await adaptador.emitir(CREDENCIAIS, PEDIDO)
      expect(r.sucesso).toBe(false)
      expect(r.erro).toContain('id')
    })

    it('não rebenta com uma resposta que não é JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }))
      const r = await adaptador.emitir(CREDENCIAIS, PEDIDO)
      expect(r.sucesso).toBe(false)
      expect(r.erro).toContain('Resposta inesperada')
    })

    it('usa o endpoint próprio da nota de crédito', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(json({ invoice: { id: 9 } }))
        .mockResolvedValueOnce(json({ invoice: { id: 9, sequence_number: 'NC 2026/1' } }))

      await adaptador.emitir(CREDENCIAIS, { ...PEDIDO, tipo: 'credit_note' })

      expect(urlDe(0)).toContain('/credit_notes.json')
    })
  })

  describe('criarConta', () => {
    it('sem chave de parceiro não cria nada', async () => {
      vi.stubEnv('INVOICEXPRESS_PARTNER_API_KEY', '')
      expect(adaptador.podeCriarContas()).toBe(false)

      const r = await adaptador.criarConta({ nomeOrganizacao: 'Casa do Vasco', email: 'v@exemplo.pt' })
      expect(r.sucesso).toBe(false)
      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    it('cria a conta e devolve subdomínio e chave', async () => {
      vi.stubEnv('INVOICEXPRESS_PARTNER_API_KEY', 'chave-parceiro')
      vi.mocked(fetch).mockResolvedValueOnce(json({
        account: {
          id: '999', name: 'Casa do Vasco',
          url: 'https://casadovasco.app.invoicexpress.com',
          api_key: 'chave-nova', state: 'active',
        },
      }, 201))

      const r = await adaptador.criarConta({
        nomeOrganizacao: 'Casa do Vasco', email: 'v@exemplo.pt', nif: '123456789',
      })

      expect(r).toMatchObject({ sucesso: true, conta: 'casadovasco', apiKey: 'chave-nova', contaId: '999' })

      const corpo = corpoDe(0).account as Record<string, unknown>
      expect(corpo.fiscal_id).toBe('123456789')
      expect(corpo.tax_country).toBe('1')
      expect(corpo.terms).toBe('1')
      // A senha é gerada e nunca reutilizada.
      expect(String(corpo.password)).toMatch(/^Anf-/)
    })

    it('usa a chave de parceiro, não a da conta', async () => {
      vi.stubEnv('INVOICEXPRESS_PARTNER_API_KEY', 'chave-parceiro')
      vi.mocked(fetch).mockResolvedValueOnce(json({
        account: { url: 'https://x.app.invoicexpress.com', api_key: 'k' },
      }, 201))

      await adaptador.criarConta({ nomeOrganizacao: 'X', email: 'x@exemplo.pt' })

      expect(urlDe(0)).toContain('api_key=chave-parceiro')
      expect(urlDe(0)).toContain('/api/accounts/create.json')
    })

    it('falha quando o serviço não devolve credenciais', async () => {
      vi.stubEnv('INVOICEXPRESS_PARTNER_API_KEY', 'chave-parceiro')
      vi.mocked(fetch).mockResolvedValueOnce(json({ account: { id: '1' } }, 201))

      const r = await adaptador.criarConta({ nomeOrganizacao: 'X', email: 'x@exemplo.pt' })
      expect(r.sucesso).toBe(false)
    })
  })

  describe('configurarComunicacaoAt', () => {
    it('comunica em modo automático', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ success: 'true' }))

      const r = await adaptador.configurarComunicacaoAt(CREDENCIAIS, {
        subutilizador: '123456789/1', senha: 'segredo',
      })

      expect(r.sucesso).toBe(true)
      expect(urlDe(0)).toContain('/api/v3/accounts/at_communication.json')
      expect(corpoDe(0)).toEqual({
        at_communication: {
          at_subuser: '123456789/1',
          at_password: 'segredo',
          communication_type: 'auto',
        },
      })
    })

    it('devolve o erro da AT em vez de rebentar', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ errors: { error: 'senha inválida' } }, 422))
      const r = await adaptador.configurarComunicacaoAt(CREDENCIAIS, {
        subutilizador: '123456789/1', senha: 'errada',
      })
      expect(r.sucesso).toBe(false)
      expect(r.erro).toContain('senha inválida')
    })
  })

  describe('criarSerie', () => {
    it('cria a série e marca-a como corrente', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ sequence: { id: 55, serie: 'ANF2026' } }))

      const r = await adaptador.criarSerie(CREDENCIAIS, 'ANF2026')

      expect(r).toMatchObject({ sucesso: true, serieId: '55', serieNome: 'ANF2026' })
      expect(corpoDe(0)).toEqual({ sequence: { serie: 'ANF2026', current: true } })
    })
  })

  describe('exportarSaft', () => {
    it('devolve o URL quando o ficheiro está pronto', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ url: 'https://ficheiro/saft.xml' }))

      const r = await adaptador.exportarSaft(CREDENCIAIS, 2026, 7)

      expect(r).toEqual({ sucesso: true, url: 'https://ficheiro/saft.xml' })
      expect(urlDe(0)).toContain('saft_params%5Byear%5D=2026')
      expect(urlDe(0)).toContain('saft_params%5Bmonth%5D=7')
    })

    it('sinaliza que ainda está a gerar em vez de falhar', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ message: 'started' }, 202))
      const r = await adaptador.exportarSaft(CREDENCIAIS, 2026, 7)
      expect(r).toEqual({ sucesso: true, aindaAGerar: true })
    })

    it('explica que não há documentos no mês', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(json({ message: 'no docs' }, 422))
      const r = await adaptador.exportarSaft(CREDENCIAIS, 2026, 1)
      expect(r.sucesso).toBe(false)
      expect(r.erro).toContain('Não há documentos')
    })
  })
})

describe('subdominioDe', () => {
  it('extrai o subdomínio do URL da conta', () => {
    expect(subdominioDe('https://casadovasco.app.invoicexpress.com')).toBe('casadovasco')
    expect(subdominioDe('casadovasco.app.invoicexpress.com')).toBe('casadovasco')
  })
})
