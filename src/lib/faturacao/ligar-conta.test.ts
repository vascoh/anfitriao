import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const estado = vi.hoisted(() => ({
  existente: null as Record<string, unknown> | null,
  inserido: null as Record<string, unknown> | null,
  lerSeries: vi.fn(),
}))

vi.mock('../supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: estado.existente }) }) }),
      }),
      insert: (linha: Record<string, unknown>) => {
        estado.inserido = linha
        return { select: () => ({ single: async () => ({ data: { id: 'c1', ...linha }, error: null }) }) }
      },
    }),
  }),
}))

vi.mock('../crypto', () => ({
  estaConfigurada: () => true,
  encriptar: (v: string) => `enc(${v})`,
  decifrar: (v: string) => v,
}))

vi.mock('./index', () => ({
  getInvoicingAdapter: () => ({ lerSeries: estado.lerSeries }),
}))

const { ligarContaExistente } = await import('./contas')

const PEDIDO = { conta: 'vascootelocoutinh', apiKey: 'a'.repeat(40), nomeFiscal: 'Vasco', nif: '208257896' }

beforeEach(() => {
  estado.existente = null
  estado.inserido = null
  estado.lerSeries.mockReset()
})

describe('ligarContaExistente', () => {
  it('fica pronta na série que já existe, com a emissão automática DESLIGADA', async () => {
    estado.lerSeries.mockResolvedValueOnce({
      sucesso: true,
      series: [
        { id: '4705193', nome: 'NOVA', padrao: false, comunicada: true, ultimaFaturaRecibo: 0 },
        { id: '4705210', nome: 'seria-a', padrao: true, comunicada: true, ultimaFaturaRecibo: 152 },
      ],
    })

    const r = await ligarContaExistente('user_1', PEDIDO)

    expect(r.ok).toBe(true)
    expect(estado.inserido).toMatchObject({
      conta: 'vascootelocoutinh',
      serie_id: '4705210',
      serie_nome: 'seria-a',
      at_estado: 'configurada',
      // Outro programa pode estar a faturar as mesmas estadias.
      emissao_automatica: false,
    })
    expect(estado.inserido?.api_key).toBe(`enc(${PEDIDO.apiKey})`)
  })

  it('sem série registada na AT fica à espera do passo da AT', async () => {
    estado.lerSeries.mockResolvedValueOnce({
      sucesso: true,
      series: [{ id: '1', nome: 'X', padrao: true, comunicada: false, ultimaFaturaRecibo: 0 }],
    })

    await ligarContaExistente('user_1', PEDIDO)

    expect(estado.inserido).toMatchObject({ at_estado: 'por_configurar', serie_id: null })
  })

  it('não guarda nada quando o InvoiceXpress recusa a chave', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.lerSeries.mockResolvedValueOnce({ sucesso: false, erro: 'InvoiceXpress devolveu 401' })

    const r = await ligarContaExistente('user_1', PEDIDO)

    expect(r).toMatchObject({ ok: false, estado: 422 })
    expect(estado.inserido).toBeNull()
  })

  it('não troca uma conta já ligada por outra', async () => {
    estado.existente = { id: 'c0', conta: 'outra' }

    const r = await ligarContaExistente('user_1', PEDIDO)

    expect(r).toMatchObject({ ok: false, estado: 409 })
    expect(estado.lerSeries).not.toHaveBeenCalled()
  })

  it('é idempotente para a mesma conta', async () => {
    estado.existente = { id: 'c0', conta: 'vascootelocoutinh' }

    const r = await ligarContaExistente('user_1', PEDIDO)

    expect(r.ok).toBe(true)
    expect(estado.inserido).toBeNull()
  })
})
