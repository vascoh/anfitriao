import 'server-only'
import type { InvoicingAdapter, PedidoFatura, ResultadoFatura, LinhaFatura } from './types'

/**
 * Adaptador para o InvoiceXpress (certificado pela AT).
 *
 * Contrato implementado a partir da documentação pública em
 * https://docs.invoicexpress.com/invoices (consultada 2026-07-28):
 * - POST https://{conta}.app.invoicexpress.com/{tipo}.json?api_key=…
 * - PUT  …/{tipo}/{id}/change-state.json    → finalizar o documento
 * - PUT  …/{tipo}/{id}/email-document.json  → enviar ao cliente
 *
 * Um documento criado nasce em `draft`. Só depois de passar a `finalized` é
 * que recebe numeração legal, ATCUD e hash SAF-T — por isso a emissão são
 * sempre duas chamadas, e um `draft` que fique para trás não é uma fatura.
 */

const TIPO_ENDPOINT: Record<PedidoFatura['tipo'], string> = {
  invoice: 'invoices',
  invoice_receipt: 'invoice_receipts',
  simplified_invoice: 'simplified_invoices',
  credit_note: 'credit_notes',
}

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
  errors?: unknown
}

export class InvoiceXpressAdapter implements InvoicingAdapter {
  readonly nome = 'InvoiceXpress'

  private get conta(): string | undefined {
    return process.env.INVOICEXPRESS_ACCOUNT
  }

  private get apiKey(): string | undefined {
    return process.env.INVOICEXPRESS_API_KEY
  }

  estaConfigurado(): boolean {
    return Boolean(this.conta && this.apiKey)
  }

  private url(caminho: string): string {
    return `https://${this.conta}.app.invoicexpress.com/${caminho}?api_key=${this.apiKey}`
  }

  private async pedir(
    metodo: 'POST' | 'PUT',
    caminho: string,
    corpo?: unknown,
  ): Promise<RespostaInvoiceXpress> {
    const res = await fetch(this.url(caminho), {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })

    const texto = await res.text()
    let json: RespostaInvoiceXpress = {}
    try {
      json = texto ? (JSON.parse(texto) as RespostaInvoiceXpress) : {}
    } catch {
      // resposta não-JSON: guarda-se o início do corpo para diagnóstico
      throw new Error(`Resposta inesperada (${res.status}): ${texto.slice(0, 200)}`)
    }

    if (!res.ok) {
      throw new Error(`InvoiceXpress devolveu ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`)
    }

    return json
  }

  async emitir(pedido: PedidoFatura): Promise<ResultadoFatura> {
    if (!this.estaConfigurado()) {
      return { sucesso: false, erro: 'InvoiceXpress não configurado (INVOICEXPRESS_ACCOUNT/INVOICEXPRESS_API_KEY em falta).' }
    }

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
      const criado = await this.pedir('POST', `${endpoint}.json`, corpo)
      const id = criado.invoice?.id
      if (!id) {
        return { sucesso: false, erro: 'InvoiceXpress não devolveu o id do documento.' }
      }

      // Finalizar: sem isto não há numeração legal nem ATCUD
      const finalizado = await this.pedir('PUT', `${endpoint}/${id}/change-state.json`, {
        invoice: { state: 'finalized' },
      })

      if (pedido.enviarPorEmail && pedido.cliente.email) {
        try {
          await this.pedir('PUT', `${endpoint}/${id}/email-document.json`, {
            message: { client: { email: pedido.cliente.email }, subject: 'A sua fatura' },
          })
        } catch (err) {
          // O documento já é legalmente válido; falhar o envio não o invalida
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
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : 'Erro desconhecido' }
    }
  }
}
