import 'server-only'
import type {
  InvoicingAdapter, PedidoFatura, ResultadoFatura, LinhaFatura,
  CredenciaisConta, PedidoConta, ResultadoConta, PedidoComunicacaoAt,
  ResultadoSimples, ResultadoSerie, ResultadoSaft,
} from './types'

/**
 * Adaptador para o InvoiceXpress (certificado pela AT).
 *
 * Contrato implementado a partir da documentação pública
 * (https://docs.invoicexpress.com, consultada 2026-08-03):
 *
 * | O quê | Endpoint |
 * |---|---|
 * | Criar conta de anfitrião | `POST /api/accounts/create.json` (chave de parceiro) |
 * | Ligar credenciais da AT | `POST /api/v3/accounts/at_communication.json` |
 * | Criar e registar série | `POST /sequences.json` |
 * | Emitir documento | `POST /{tipo}.json` → `PUT /{tipo}/{id}/change-state.json` |
 * | Enviar ao cliente | `PUT /{tipo}/{id}/email-document.json` |
 * | SAF-T do mês | `GET /api/export_saft.json` |
 *
 * Duas coisas que o serviço faz e é preciso respeitar:
 *
 * 1. **Um documento nasce em `draft`.** Só ao passar a `finalized` recebe
 *    numeração legal, ATCUD e hash SAF-T. Um `draft` esquecido não é fatura.
 * 2. **Sem credenciais da AT não há séries registadas**, e sem série não há
 *    numeração. É por isso que a configuração da AT vem antes de tudo.
 */

const TIPO_ENDPOINT: Record<PedidoFatura['tipo'], string> = {
  invoice: 'invoices',
  invoice_receipt: 'invoice_receipts',
  simplified_invoice: 'simplified_invoices',
  credit_note: 'credit_notes',
}

/** Conta usada para criar contas de anfitriões (chave de parceiro). */
const CONTA_PARCEIRO = 'api'

/** O InvoiceXpress espera datas em dd/mm/yyyy, não ISO. */
function paraDataPt(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * O InvoiceXpress identifica impostos por **nome**, não por percentagem, e
 * aplica o imposto por omissão da conta quando o nome não existe — falhando
 * em silêncio. Usam-se os nomes convencionais das contas portuguesas.
 */
function nomeImposto(l: LinhaFatura): string {
  if (l.taxaIva === 0) return 'Isento'
  return `IVA${l.taxaIva}`
}

interface RespostaInvoiceXpress {
  invoice?: {
    id?: number
    status?: string
    sequence_number?: string
    atcud?: string
    permalink?: string
    total?: number
  }
  account?: { id?: string; name?: string; url?: string; api_key?: string; state?: string }
  sequence?: { id?: number; serie?: string; current?: boolean }
  url?: string
  message?: string
  success?: string
  errors?: unknown
}

/** Erro com o estado HTTP, para quem chama distinguir "não deu" de "ainda não". */
class ErroInvoiceXpress extends Error {
  constructor(readonly estado: number, mensagem: string) {
    super(mensagem)
  }
}

function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Erro desconhecido'
}

export class InvoiceXpressAdapter implements InvoicingAdapter {
  readonly nome = 'InvoiceXpress'

  /** Chave de parceiro: só serve para criar contas de anfitriões. */
  private get chaveParceiro(): string | undefined {
    return process.env.INVOICEXPRESS_PARTNER_API_KEY
  }

  podeCriarContas(): boolean {
    return Boolean(this.chaveParceiro)
  }

  private url(conta: string, caminho: string, apiKey: string, params?: Record<string, string>): string {
    const qs = new URLSearchParams({ api_key: apiKey, ...(params ?? {}) })
    return `https://${conta}.app.invoicexpress.com/${caminho}?${qs}`
  }

  private async pedir(
    metodo: 'GET' | 'POST' | 'PUT',
    conta: string,
    apiKey: string,
    caminho: string,
    corpo?: unknown,
    params?: Record<string, string>,
  ): Promise<RespostaInvoiceXpress> {
    const res = await fetch(this.url(conta, caminho, apiKey, params), {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    })

    const texto = await res.text()
    let json: RespostaInvoiceXpress = {}
    try {
      json = texto ? (JSON.parse(texto) as RespostaInvoiceXpress) : {}
    } catch {
      // Resposta não-JSON: guarda-se o início do corpo para diagnóstico.
      throw new ErroInvoiceXpress(res.status, `Resposta inesperada (${res.status}): ${texto.slice(0, 200)}`)
    }

    // 202 no SAF-T significa "estou a gerar", não é erro.
    if (!res.ok && res.status !== 202) {
      const detalhe = JSON.stringify(json.errors ?? json.message ?? json).slice(0, 300)
      throw new ErroInvoiceXpress(res.status, `InvoiceXpress devolveu ${res.status}: ${detalhe}`)
    }

    return { ...json, ...(res.status === 202 ? { message: json.message ?? 'a gerar' } : {}) }
  }

  // ─── Provisionamento ──────────────────────────────────────────────────────

  async criarConta(pedido: PedidoConta): Promise<ResultadoConta> {
    const chave = this.chaveParceiro
    if (!chave) {
      return { sucesso: false, erro: 'Falta INVOICEXPRESS_PARTNER_API_KEY — não é possível criar contas de faturação.' }
    }

    // A palavra-passe é gerada e nunca guardada: o anfitrião entra na conta
    // pelo Anfitrião, e se algum dia quiser entrar diretamente recupera-a por
    // email. Guardar uma senha que não precisamos seria responsabilidade a
    // mais sem nenhum ganho.
    const senha = `Anf-${crypto.randomUUID()}`

    const corpo = {
      account: {
        first_name: pedido.primeiroNome || pedido.nomeOrganizacao.split(' ')[0] || 'Anfitrião',
        last_name: pedido.ultimoNome || '-',
        organization_name: pedido.nomeOrganizacao,
        email: pedido.email,
        password: senha,
        phone: pedido.telefone ?? undefined,
        fiscal_id: pedido.nif ?? undefined,
        tax_country: '1', // Portugal
        language: 'pt',
        terms: '1',
      },
    }

    try {
      const r = await this.pedir('POST', CONTA_PARCEIRO, chave, 'api/accounts/create.json', corpo)
      const conta = r.account
      if (!conta?.api_key || !conta.url) {
        return { sucesso: false, erro: 'O InvoiceXpress criou a conta mas não devolveu credenciais.' }
      }
      return {
        sucesso: true,
        contaId: conta.id,
        conta: subdominioDe(conta.url),
        apiKey: conta.api_key,
      }
    } catch (e) {
      return { sucesso: false, erro: mensagemDeErro(e) }
    }
  }

  async configurarComunicacaoAt(c: CredenciaisConta, p: PedidoComunicacaoAt): Promise<ResultadoSimples> {
    try {
      await this.pedir('POST', c.conta, c.apiKey, 'api/v3/accounts/at_communication.json', {
        at_communication: {
          at_subuser: p.subutilizador,
          at_password: p.senha,
          // 'auto': o fornecedor comunica cada documento à AT sozinho. É o
          // único modo em que o anfitrião não tem trabalho nenhum.
          communication_type: 'auto',
        },
      })
      return { sucesso: true }
    } catch (e) {
      return { sucesso: false, erro: mensagemDeErro(e) }
    }
  }

  async criarSerie(c: CredenciaisConta, nome: string): Promise<ResultadoSerie> {
    try {
      const r = await this.pedir('POST', c.conta, c.apiKey, 'sequences.json', {
        sequence: { serie: nome, current: true },
      })
      const id = r.sequence?.id
      if (!id) return { sucesso: false, erro: 'O InvoiceXpress não devolveu o id da série.' }
      return { sucesso: true, serieId: String(id), serieNome: r.sequence?.serie ?? nome }
    } catch (e) {
      return { sucesso: false, erro: mensagemDeErro(e) }
    }
  }

  // ─── Emissão ──────────────────────────────────────────────────────────────

  async emitir(c: CredenciaisConta, pedido: PedidoFatura): Promise<ResultadoFatura> {
    const endpoint = TIPO_ENDPOINT[pedido.tipo]

    // A isenção é uma propriedade do documento, não da linha: usa-se o
    // primeiro motivo encontrado, que no AL é sempre o da taxa turística.
    const motivoIsencao = pedido.linhas.find(l => l.motivoIsencao)?.motivoIsencao

    const corpo = {
      invoice: {
        date: paraDataPt(pedido.data),
        due_date: paraDataPt(pedido.data),
        reference: pedido.referencia,
        observations: pedido.observacoes,
        ...(pedido.serieId ? { sequence_id: Number(pedido.serieId) } : {}),
        ...(motivoIsencao ? { tax_exemption_reason: motivoIsencao } : {}),
        client: {
          name: pedido.cliente.nome,
          code: pedido.cliente.nif || pedido.cliente.email || pedido.cliente.nome,
          email: pedido.cliente.email ?? undefined,
          fiscal_id: pedido.cliente.nif ?? undefined,
          address: pedido.cliente.morada ?? undefined,
          city: pedido.cliente.cidade ?? undefined,
          postal_code: pedido.cliente.codigoPostal ?? undefined,
          country: pedido.cliente.pais ?? undefined,
        },
        items: pedido.linhas.map(l => ({
          name: l.nome,
          description: l.descricao,
          unit_price: l.precoUnitario,
          quantity: l.quantidade,
          tax: { name: nomeImposto(l) },
        })),
      },
    }

    try {
      const criado = await this.pedir('POST', c.conta, c.apiKey, `${endpoint}.json`, corpo)
      const id = criado.invoice?.id
      if (!id) {
        return { sucesso: false, erro: 'InvoiceXpress não devolveu o id do documento.' }
      }

      // Finalizar: sem isto não há numeração legal nem ATCUD.
      const finalizado = await this.pedir('PUT', c.conta, c.apiKey, `${endpoint}/${id}/change-state.json`, {
        invoice: { state: 'finalized' },
      })

      if (pedido.enviarPorEmail && pedido.cliente.email) {
        try {
          await this.pedir('PUT', c.conta, c.apiKey, `${endpoint}/${id}/email-document.json`, {
            message: { client: { email: pedido.cliente.email }, subject: 'A sua fatura' },
          })
        } catch (err) {
          // O documento já é legalmente válido; falhar o envio não o invalida.
          console.error('[invoicexpress] envio de email falhou', err)
        }
      }

      const doc = finalizado.invoice ?? criado.invoice
      return {
        sucesso: true,
        idExterno: String(id),
        numero: doc?.sequence_number,
        atcud: doc?.atcud,
        urlPdf: doc?.permalink,
        total: doc?.total,
      }
    } catch (e) {
      return { sucesso: false, erro: mensagemDeErro(e) }
    }
  }

  // ─── SAF-T ────────────────────────────────────────────────────────────────

  /**
   * O SAF-T é gerado de forma assíncrona: a primeira chamada devolve 202 e é
   * preciso voltar a pedir até vir o URL. Quem chama decide quantas vezes.
   */
  async exportarSaft(c: CredenciaisConta, ano: number, mes: number): Promise<ResultadoSaft> {
    try {
      const r = await this.pedir('GET', c.conta, c.apiKey, 'api/export_saft.json', undefined, {
        'saft_params[year]': String(ano),
        'saft_params[month]': String(mes),
      })
      if (r.url) return { sucesso: true, url: r.url }
      return { sucesso: true, aindaAGerar: true }
    } catch (e) {
      // 422 = não há documentos no período. Não é falha, é resposta.
      if (e instanceof ErroInvoiceXpress && e.estado === 422) {
        return { sucesso: false, erro: 'Não há documentos emitidos neste mês.' }
      }
      return { sucesso: false, erro: mensagemDeErro(e) }
    }
  }
}

/** "https://minhaconta.app.invoicexpress.com" → "minhaconta" */
export function subdominioDe(url: string): string {
  const semProtocolo = url.replace(/^https?:\/\//, '')
  return semProtocolo.split('.')[0]
}
