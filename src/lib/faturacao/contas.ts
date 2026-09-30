import 'server-only'
import { createAdminClient } from '../supabase'
import { encriptar, decifrar, estaConfigurada as encriptacaoConfigurada } from '../crypto'
import { getInvoicingAdapter } from './index'
import type { CredenciaisConta, PedidoConta } from './types'
import { escolherSerie } from './ligar'

/**
 * Conta de faturação de cada anfitrião: criação, leitura e estado.
 *
 * Tudo o que envolve a chave da conta passa por aqui, e a chave nunca sai
 * deste módulo em claro — quem precisa dela recebe `CredenciaisConta` para
 * uma chamada e mais nada.
 */

export interface ContaFaturacao {
  id: string
  owner_id: string
  fornecedor: string
  conta: string
  conta_id: string | null
  nome_fiscal: string
  nif: string | null
  /** Chave da conta no fornecedor, encriptada. Nunca sai deste módulo em claro. */
  api_key: string
  at_estado: 'por_configurar' | 'configurada' | 'falhou'
  at_erro: string | null
  at_configurada_em: string | null
  serie_id: string | null
  serie_nome: string | null
  estado: 'ativa' | 'suspensa'
  emissao_automatica: boolean
  criado_em: string
}

/** O que pode ser mostrado ao anfitrião. Nunca inclui a chave. */
export type ContaPublica = Omit<ContaFaturacao, 'owner_id' | 'api_key'> & { pronta: boolean }

/**
 * Uma conta só está pronta a emitir quando a AT está ligada **e** existe
 * série. Sem série não há numeração legal, e sem numeração o documento não é
 * uma fatura — é um rascunho caro.
 */
export function contaPronta(c: Pick<ContaFaturacao, 'at_estado' | 'serie_id' | 'estado'>): boolean {
  return c.estado === 'ativa' && c.at_estado === 'configurada' && Boolean(c.serie_id)
}

export function paraPublica(c: ContaFaturacao): ContaPublica {
  const { owner_id: _dono, api_key: _chave, ...resto } = c
  return { ...resto, pronta: contaPronta(c) }
}

export async function obterConta(ownerId: string): Promise<ContaFaturacao | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('faturacao_contas')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('fornecedor', 'invoicexpress')
    .maybeSingle()
  return (data as ContaFaturacao | null) ?? null
}

/**
 * Credenciais para uma chamada ao fornecedor. Devolve null quando não há
 * conta ou quando a chave não pode ser lida — nunca lança, para o chamador
 * poder responder com uma mensagem útil em vez de um 500.
 */
export async function credenciaisDe(conta: ContaFaturacao): Promise<CredenciaisConta | null> {
  if (!encriptacaoConfigurada()) return null
  try {
    return { conta: conta.conta, apiKey: decifrar(conta.api_key) }
  } catch {
    return null
  }
}

/** Carrega conta + credenciais numa só operação, que é como é sempre usado. */
export async function contaComCredenciais(
  ownerId: string,
): Promise<{ conta: ContaFaturacao; credenciais: CredenciaisConta } | null> {
  const conta = await obterConta(ownerId)
  if (!conta) return null
  const credenciais = await credenciaisDe(conta)
  if (!credenciais) return null
  return { conta, credenciais }
}

export type ResultadoCriacao =
  | { ok: true; conta: ContaFaturacao }
  | { ok: false; erro: string; estado: number }

/**
 * Cria a conta do anfitrião no fornecedor e guarda-a encriptada.
 *
 * Idempotente por omissão: se já existir conta, devolve-a em vez de criar
 * outra. Criar duas contas para o mesmo NIF partiria a numeração em duas
 * séries paralelas, que é dos poucos erros de faturação sem volta atrás.
 */
export async function criarContaParaAnfitriao(
  ownerId: string,
  pedido: PedidoConta,
): Promise<ResultadoCriacao> {
  const existente = await obterConta(ownerId)
  if (existente) return { ok: true, conta: existente }

  if (!encriptacaoConfigurada()) {
    return {
      ok: false,
      estado: 503,
      erro: 'O servidor não tem chave de encriptação configurada (APP_ENCRYPTION_KEY). A chave da conta de faturação não pode ser guardada em segurança.',
    }
  }

  const adaptador = getInvoicingAdapter()
  if (!adaptador.podeCriarContas()) {
    return {
      ok: false,
      estado: 503,
      erro: 'A criação de contas de faturação não está disponível (falta a chave de parceiro).',
    }
  }

  const criada = await adaptador.criarConta(pedido)
  if (!criada.sucesso || !criada.conta || !criada.apiKey) {
    // Sem isto a falha só existia no toast do anfitrião, que desaparece.
    console.error('[faturacao] criação de conta falhou:', criada.erro)
    return { ok: false, estado: 502, erro: criada.erro ?? 'Não foi possível criar a conta de faturação.' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faturacao_contas')
    .insert({
      owner_id: ownerId,
      fornecedor: 'invoicexpress',
      conta: criada.conta,
      conta_id: criada.contaId ?? null,
      api_key: encriptar(criada.apiKey),
      nome_fiscal: pedido.nomeOrganizacao,
      nif: pedido.nif ?? null,
    })
    .select()
    .single()

  if (error) {
    // A conta existe do lado do fornecedor mas não ficou guardada aqui. É o
    // pior estado possível — registá-lo com a chave à vista nos logs seria
    // pior ainda, por isso fica só o que permite diagnosticar.
    console.error('[faturacao] conta criada no fornecedor mas não guardada:', error.message, {
      conta: criada.conta,
    })
    return {
      ok: false,
      estado: 500,
      erro: 'A conta foi criada mas não ficou guardada. Contacta o suporte antes de tentar outra vez.',
    }
  }

  return { ok: true, conta: data as ContaFaturacao }
}

export interface PedidoLigacao {
  /** Subdomínio já normalizado (`normalizarSubdominio`). */
  conta: string
  apiKey: string
  nomeFiscal: string
  nif: string | null
}

/**
 * Liga uma conta de faturação que o anfitrião já tinha.
 *
 * Antes de guardar, lê as séries da conta: se a chave ou o subdomínio
 * estiverem errados, falha aqui e não na primeira fatura. Se houver série
 * registada na AT, a conta fica logo pronta a emitir nela, com a numeração
 * onde estava.
 *
 * ⚠️ A emissão automática fica **desligada**. Quem liga uma conta existente
 * está quase sempre a faturar noutro sítio (o Amenitiz, por exemplo). Ligá-la
 * sozinha era emitir uma segunda fatura por cada estadia, e as duas iam para a
 * AT. Liga-a o anfitrião, no dia em que deixar de faturar no outro programa.
 */
export async function ligarContaExistente(
  ownerId: string,
  pedido: PedidoLigacao,
): Promise<ResultadoCriacao & { serieEscolhida?: string | null }> {
  const existente = await obterConta(ownerId)
  if (existente) {
    if (existente.conta === pedido.conta) return { ok: true, conta: existente }
    return {
      ok: false,
      estado: 409,
      erro: 'Já tens outra conta de faturação ligada. Fala connosco antes de a trocar — mudar a meio parte a numeração.',
    }
  }

  if (!encriptacaoConfigurada()) {
    return {
      ok: false,
      estado: 503,
      erro: 'O servidor não tem chave de encriptação configurada (APP_ENCRYPTION_KEY). A chave da conta de faturação não pode ser guardada em segurança.',
    }
  }

  const lidas = await getInvoicingAdapter().lerSeries({ conta: pedido.conta, apiKey: pedido.apiKey })
  if (!lidas.sucesso) {
    console.error('[faturacao] ligação de conta existente recusada:', lidas.erro, { conta: pedido.conta })
    return {
      ok: false,
      estado: 422,
      erro: 'O InvoiceXpress não aceitou este endereço e esta chave. Confirma o nome da conta e copia outra vez a chave da API.',
    }
  }

  const serie = escolherSerie(lidas.series ?? [])
  const agora = new Date().toISOString()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faturacao_contas')
    .insert({
      owner_id: ownerId,
      fornecedor: 'invoicexpress',
      conta: pedido.conta,
      api_key: encriptar(pedido.apiKey),
      nome_fiscal: pedido.nomeFiscal,
      nif: pedido.nif,
      // Uma série com ATCUD só existe porque a AT a aceitou: a comunicação
      // está feita. Sem série registada, o passo da AT continua por dar.
      at_estado: serie ? 'configurada' : 'por_configurar',
      at_configurada_em: serie ? agora : null,
      serie_id: serie?.id ?? null,
      serie_nome: serie?.nome ?? null,
      emissao_automatica: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[faturacao] conta existente não guardada:', error.message, { conta: pedido.conta })
    return { ok: false, estado: 500, erro: 'Não foi possível guardar a ligação. Tenta outra vez.' }
  }

  return { ok: true, conta: data as ContaFaturacao, serieEscolhida: serie?.nome ?? null }
}
