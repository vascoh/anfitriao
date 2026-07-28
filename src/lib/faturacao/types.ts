/**
 * Faturação certificada.
 *
 * Em Portugal não é legal emitir faturas a partir de software não certificado
 * pela AT. Por isso o Anfitrião **não emite faturas** — delega num fornecedor
 * certificado (InvoiceXpress, Vendus, Moloni) através deste adaptador.
 *
 * O que fica deste lado: decidir *o que* faturar e *com que taxas*. O que fica
 * do lado do fornecedor: numeração, ATCUD, hash SAF-T, QR code e comunicação
 * à AT. Nunca replicar nada disso aqui.
 */

/** Documento a emitir. `invoice_receipt` (fatura-recibo) é o caso normal no AL. */
export type TipoDocumento = 'invoice' | 'invoice_receipt' | 'simplified_invoice' | 'credit_note'

export interface ClienteFatura {
  nome: string
  email?: string | null
  /** NIF. Sem ele a AT trata como consumidor final. */
  nif?: string | null
  morada?: string | null
  codigoPostal?: string | null
  cidade?: string | null
  /** Código ISO 3166-1 alfa-2, ex.: 'PT', 'FR'. */
  pais?: string | null
}

export interface LinhaFatura {
  nome: string
  descricao: string
  /** Preço unitário **sem IVA**. */
  precoUnitario: number
  quantidade: number
  /** Taxa de IVA em percentagem. 0 quando isento. */
  taxaIva: number
  /**
   * Código de isenção do CIVA quando `taxaIva` é 0.
   * Ex.: 'M99' para a taxa turística (não sujeita, art. 2.º n.º 2 do CIVA).
   */
  motivoIsencao?: string
}

export interface PedidoFatura {
  tipo: TipoDocumento
  cliente: ClienteFatura
  linhas: LinhaFatura[]
  /** Data do documento, YYYY-MM-DD. */
  data: string
  /** Referência interna, tipicamente o id da reserva. */
  referencia?: string
  observacoes?: string
  /** Enviar por email ao cliente depois de finalizar. */
  enviarPorEmail?: boolean
}

export interface ResultadoFatura {
  sucesso: boolean
  /** Identificador do documento no fornecedor. */
  idExterno?: string
  /** Número sequencial legal, ex.: 'FR 2026/123'. */
  numero?: string
  /** Código único de documento exigido pela AT. */
  atcud?: string
  /** Link permanente para o PDF. */
  urlPdf?: string
  total?: number
  erro?: string
}

/**
 * Contrato que qualquer fornecedor certificado tem de cumprir.
 * Trocar de fornecedor deve ser uma alteração isolada a um ficheiro.
 */
export interface InvoicingAdapter {
  readonly nome: string
  /** True quando há credenciais configuradas para este fornecedor. */
  estaConfigurado(): boolean
  emitir(pedido: PedidoFatura): Promise<ResultadoFatura>
}
