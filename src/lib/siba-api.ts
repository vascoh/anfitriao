import 'server-only'
import { createHash } from 'node:crypto'
import {
  construirMovimentoBal,
  construirEnvelopeSoap,
  interpretarRespostaSiba,
  type UnidadeHoteleira,
  type BoletimHospede,
  type RespostaSiba,
} from './siba-xml'

/**
 * Submissão de boletins de alojamento ao SIBA por web service.
 *
 * Substitui o placeholder que devolvia 501 à espera de "documentação técnica
 * da AIMA". O serviço é público (ver `siba-xml.ts` para o contrato) e as
 * credenciais são do anfitrião, por estabelecimento — não da plataforma. Por
 * isso nada aqui lê chaves de ambiente: só o endereço do serviço é
 * configurável, para se poder apontar ao ambiente de testes do SIBA.
 */

const URL_PRODUCAO = 'https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx'
const SOAP_ACTION = 'http://sef.pt/EntregaBoletinsAlojamento'
const TIMEOUT_MS = 30_000
const TENTATIVAS = 3

export interface ResultadoSubmissao extends RespostaSiba {
  /**
   * Impressão digital do que foi enviado, para prova de submissão: permite
   * mostrar mais tarde que aquele boletim, exatamente com aqueles dados, foi
   * entregue naquele momento. É o que interessa numa fiscalização — a
   * submissão sem prova vale pouco.
   */
  hashEnvio: string
  /** Resposta em bruto, guardada tal como veio. */
  respostaBruta?: string
  /** Quantas tentativas foram precisas (1 = à primeira). */
  tentativas: number
}

function urlDoServico(): string {
  return process.env.SIBA_WS_URL || URL_PRODUCAO
}

/**
 * O SIBA é conhecido por devolver páginas de erro HTML em vez de SOAP quando
 * está indisponível, e por 503 intermitentes. Vale sempre a pena repetir.
 */
function vaiTentarOutraVez(resposta: RespostaSiba | null, estado?: number): boolean {
  if (estado !== undefined && estado >= 500) return true
  if (resposta === null) return true // erro de rede
  return resposta.codigo === 'resposta_invalida'
}

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Entrega um movimento de boletins e devolve o resultado com prova de envio.
 *
 * Não valida os boletins: isso é `camposEmFalta` em `siba-xml.ts`, e deve ser
 * corrido antes, para o anfitrião ver o que falta em português em vez de um
 * código de retorno numérico.
 */
export async function submeterBoletins(args: {
  unidade: UnidadeHoteleira
  chaveAcesso: string
  boletins: BoletimHospede[]
  numeroFicheiro: number
  dataMovimento: string
}): Promise<ResultadoSubmissao> {
  const movimento = construirMovimentoBal(args.unidade, args.boletins, {
    numeroFicheiro: args.numeroFicheiro,
    dataMovimento: args.dataMovimento,
  })
  const hashEnvio = createHash('sha256').update(movimento).digest('hex')

  const envelope = construirEnvelopeSoap({
    nipc: args.unidade.nipc,
    estabelecimento: args.unidade.estabelecimento,
    chaveAcesso: args.chaveAcesso,
    movimentoBalXml: movimento,
  })

  let ultima: RespostaSiba = {
    sucesso: false,
    codigo: 'sem_resposta',
    mensagem: 'Não foi possível contactar o SIBA.',
  }
  let ultimaBruta: string | undefined

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    let estado: number | undefined
    let resposta: RespostaSiba | null = null

    try {
      const r = await fetch(urlDoServico(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: SOAP_ACTION,
        },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      estado = r.status
      ultimaBruta = await r.text()
      resposta = interpretarRespostaSiba(ultimaBruta)
      ultima = resposta

      if (resposta.sucesso) {
        return { ...resposta, hashEnvio, respostaBruta: ultimaBruta, tentativas: tentativa }
      }
    } catch (e) {
      // Falha de rede ou timeout: não há resposta para interpretar.
      ultima = {
        sucesso: false,
        codigo: 'erro_rede',
        mensagem: e instanceof Error ? e.message : 'Erro de rede ao contactar o SIBA.',
      }
    }

    const ultimaTentativa = tentativa === TENTATIVAS
    if (ultimaTentativa || !vaiTentarOutraVez(resposta, estado)) break

    // Recuo exponencial: 1 s, 2 s.
    await esperar(1000 * tentativa)
  }

  return { ...ultima, hashEnvio, respostaBruta: ultimaBruta, tentativas: TENTATIVAS }
}

/**
 * Mensagem para o anfitrião a partir de um resultado falhado.
 *
 * Os códigos do SIBA não dizem nada a quem não os conhece; o que dizem sempre
 * é onde falhou (a linha) e uma descrição. Quando nem isso vem, é quase certo
 * que o problema é indisponibilidade ou credenciais.
 */
export function explicarFalha(r: RespostaSiba): string {
  if (r.codigo === 'erro_rede' || r.codigo === 'resposta_invalida') {
    return 'O portal do SIBA não respondeu. Não é um problema dos teus dados — tentamos outra vez mais tarde.'
  }
  const linha = r.linha ? ` (hóspede ${r.linha})` : ''
  return r.mensagem ? `${r.mensagem}${linha}` : `O SIBA recusou a entrega (código ${r.codigo})${linha}.`
}
