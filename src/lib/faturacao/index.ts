import 'server-only'
import { InvoiceXpressAdapter } from './invoicexpress'
import type { InvoicingAdapter } from './types'

/**
 * API pública da camada de faturação. Nenhuma rota deve importar um adaptador
 * concreto — trocar de fornecedor tem de ser uma alteração só a este ficheiro.
 *
 * Fornecedores previstos: InvoiceXpress (implementado), Vendus e Moloni. Todos
 * são certificados pela AT; a escolha é comercial, não técnica.
 */

let instancia: InvoicingAdapter | null = null

export function getInvoicingAdapter(): InvoicingAdapter {
  if (!instancia) instancia = new InvoiceXpressAdapter()
  return instancia
}

/** True quando há um fornecedor de faturação pronto a emitir. */
export function isFaturacaoConfigurada(): boolean {
  return getInvoicingAdapter().estaConfigurado()
}

export type {
  InvoicingAdapter, PedidoFatura, ResultadoFatura, LinhaFatura, ClienteFatura, TipoDocumento,
} from './types'
export {
  decomporReserva, linhasDaReserva, pedidoDaReserva, totalComIva, descricaoEstadia,
} from './mapping'
export { taxaIvaAlojamento, regiaoDoConcelho, semIva, valorIva, ISENCAO_TAXA_TURISTICA } from './iva'
