import 'server-only'
import { InvoiceXpressAdapter } from './invoicexpress'
import type { InvoicingAdapter } from './types'

/**
 * API pública da camada de faturação. Nenhuma rota deve importar um adaptador
 * concreto — trocar de fornecedor tem de ser uma alteração só a este ficheiro.
 *
 * Fornecedores previstos: InvoiceXpress (implementado), Vendus e Moloni. Todos
 * são certificados pela AT; a escolha é comercial, não técnica.
 *
 * ⚠️ O adaptador não guarda credenciais: recebe-as em cada chamada
 * (`CredenciaisConta`), porque cada anfitrião tem a sua própria conta e a
 * fatura tem de sair no NIF dele. Ver `contas.ts`.
 */

let instancia: InvoicingAdapter | null = null

export function getInvoicingAdapter(): InvoicingAdapter {
  if (!instancia) instancia = new InvoiceXpressAdapter()
  return instancia
}

/** True quando a plataforma consegue criar contas de faturação a anfitriões. */
export function podeProvisionarFaturacao(): boolean {
  return getInvoicingAdapter().podeCriarContas()
}

export type {
  InvoicingAdapter, PedidoFatura, ResultadoFatura, LinhaFatura, ClienteFatura, TipoDocumento,
  CredenciaisConta, PedidoConta, ResultadoConta, PedidoComunicacaoAt,
  ResultadoSimples, ResultadoSerie, ResultadoSaft,
} from './types'
export {
  decomporReserva, linhasDaReserva, pedidoDaReserva, totalComIva, descricaoEstadia,
  linhasDaNotaCredito,
} from './mapping'
export { taxaIvaAlojamento, regiaoDoConcelho, semIva, valorIva, ISENCAO_TAXA_TURISTICA } from './iva'
export {
  obterConta, contaComCredenciais, criarContaParaAnfitriao, contaPronta, paraPublica,
  type ContaFaturacao, type ContaPublica,
} from './contas'
