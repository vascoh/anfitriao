/**
 * Faturação certificada.
 *
 * Em Portugal não é legal emitir faturas a partir de software não certificado
 * pela AT. Por isso o Anfitrião **não emite faturas** — delega num fornecedor
 * certificado (InvoiceXpress) através deste adaptador.
 *
 * O que fica deste lado: decidir *o que* faturar e *com que taxas*, e tratar
 * de toda a configuração para que o anfitrião não tenha de a fazer. O que fica
 * do lado do fornecedor: numeração, ATCUD, hash SAF-T, QR code e comunicação
 * à AT. Nunca replicar nada disso aqui.
 *
 * ## Uma conta por anfitrião
 *
 * A fatura tem de ser emitida pelo **NIF do anfitrião**. Uma conta única da
 * plataforma emitiria tudo em nome do Anfitrião, o que não serve a
 * contabilidade de ninguém. Por isso as credenciais são um argumento, nunca
 * uma variável de ambiente: cada chamada sabe em nome de quem está a agir.
 */

/** Documento a emitir. `invoice_receipt` (fatura-recibo) é o caso normal no AL. */
export type TipoDocumento = 'invoice' | 'invoice_receipt' | 'simplified_invoice' | 'credit_note'

/** Credenciais de uma conta de anfitrião no fornecedor. */
export interface CredenciaisConta {
  /** Subdomínio: {conta}.app.invoicexpress.com */
  conta: string
  /** Chave da conta, já decifrada. */
  apiKey: string
}

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
  /** Série a usar. Sem isto o fornecedor usa a série por omissão da conta. */
  serieId?: string
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

/** Dados para criar a conta de um anfitrião no fornecedor. */
export interface PedidoConta {
  nomeOrganizacao: string
  email: string
  nif?: string | null
  primeiroNome?: string
  ultimoNome?: string
  telefone?: string | null
}

export interface ResultadoConta {
  sucesso: boolean
  contaId?: string
  /** Subdomínio da conta criada. */
  conta?: string
  /** Chave da conta criada. Encriptar antes de guardar. */
  apiKey?: string
  erro?: string
}

/** Credenciais de subutilizador da AT, para o fornecedor comunicar as séries. */
export interface PedidoComunicacaoAt {
  /** Subutilizador no formato NIF/1. */
  subutilizador: string
  senha: string
}

export interface ResultadoSimples {
  sucesso: boolean
  erro?: string
}

export interface ResultadoSerie extends ResultadoSimples {
  serieId?: string
  serieNome?: string
}

export interface ResultadoSaft extends ResultadoSimples {
  /** URL do ficheiro. Ausente com `aIndaAGerar` a true. */
  url?: string
  /** O fornecedor aceitou o pedido e está a gerar — voltar a pedir daqui a pouco. */
  aindaAGerar?: boolean
}

/**
 * Contrato que qualquer fornecedor certificado tem de cumprir.
 * Trocar de fornecedor deve ser uma alteração isolada a um ficheiro.
 */
export interface InvoicingAdapter {
  readonly nome: string

  /** True quando há chave de parceiro para criar contas de anfitriões. */
  podeCriarContas(): boolean

  /** Cria a conta do anfitrião no fornecedor, com a chave de parceiro. */
  criarConta(pedido: PedidoConta): Promise<ResultadoConta>

  /** Liga as credenciais da AT à conta, para o fornecedor comunicar as séries. */
  configurarComunicacaoAt(c: CredenciaisConta, p: PedidoComunicacaoAt): Promise<ResultadoSimples>

  /** Cria e regista na AT uma série de documentos. Exige AT já configurada. */
  criarSerie(c: CredenciaisConta, nome: string): Promise<ResultadoSerie>

  /** Emite um documento. */
  emitir(c: CredenciaisConta, pedido: PedidoFatura): Promise<ResultadoFatura>

  /** Exporta o SAF-T de um mês. */
  exportarSaft(c: CredenciaisConta, ano: number, mes: number): Promise<ResultadoSaft>
}
