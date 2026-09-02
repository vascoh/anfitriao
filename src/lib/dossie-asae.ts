import { avaliarConformidade, resumirConformidade, type CamposConformidade, type ItemConformidade, type ResumoConformidade } from './compliance'
import { estadoSiba, estaEmAtraso, type ReservaComSiba } from './estado-siba'

/**
 * O dossiê que se põe em cima da mesa numa inspeção.
 *
 * ## O que isto é, e o que não é
 *
 * É uma **compilação dos registos do próprio anfitrião**, organizada pela
 * ordem por que costumam ser pedidos. Não é emitido nem validado por entidade
 * nenhuma, e o documento diz isso na primeira linha — um papel que se parecesse
 * com um certificado oficial sem o ser seria pior do que não existir.
 *
 * O valor está em duas coisas que ninguém tem à mão quando toca a campainha:
 *
 * 1. **A prova de comunicação ao SIBA.** Cada envio deixou em `siba_submissoes`
 *    o número de ficheiro, o SHA-256 do que foi enviado, o código que o serviço
 *    devolveu e a resposta em bruto. Isso responde à pergunta «comunicou?» com
 *    um registo por envio, e não com uma afirmação.
 * 2. **O estado de cada obrigação**, com a base legal ao lado, incluindo as que
 *    estão por cumprir.
 *
 * ## Porque é que mostra o que está mal
 *
 * A tentação é gerar um documento onde está tudo verde. Seria um erro: numa
 * inspeção, um dossiê que afirma o que os registos não sustentam é pior do que
 * não ter dossiê nenhum — deixa de ser desorganização e passa a ser outra
 * coisa. Este diz o que falta, e diz o que não consegue provar.
 */

export interface EstabelecimentoDossie {
  nome: string
  endereco?: string | null
  cidade?: string | null
  rnal_numero?: string | null
  /** Do cofre SIBA: identificam a unidade perante a AIMA. */
  siba_nipc?: string | null
  siba_estabelecimento?: string | null
}

/** Uma reserva do período, já com o que interessa ao dossiê. */
export interface ReservaDossie extends ReservaComSiba {
  id: string
  check_in: string
  check_out?: string | null
  num_hospedes?: number | null
  estado?: string | null
}

/** Uma linha de `siba_submissoes` — a prova de um envio. */
export interface SubmissaoDossie {
  numero_ficheiro: number
  hash_envio: string
  sucesso: boolean
  codigo_retorno?: string | null
  mensagem?: string | null
  booking_ids?: string[] | null
  tentativas?: number | null
  criado_em: string
}

export interface LinhaComunicacao {
  bookingId: string
  check_in: string
  check_out: string | null
  pessoas: number
  /** «Comunicado», «Por comunicar», «Falhou». */
  estado: string
  detalhe: string | null
  /** Passou o prazo e continua por comunicar. */
  emAtraso: boolean
}

export interface ResumoComunicacao {
  reservas: number
  comunicadas: number
  porComunicar: number
  falhadas: number
  /** Por comunicar **e** já com a entrada passada — ver `estaEmAtraso`. */
  emAtraso: number
}

export interface Dossie {
  emitidoEm: string
  periodo: { de: string; ate: string }
  estabelecimento: EstabelecimentoDossie
  conformidade: ItemConformidade[]
  resumoConformidade: ResumoConformidade
  comunicacao: ResumoComunicacao
  linhas: LinhaComunicacao[]
  submissoes: SubmissaoDossie[]
  /** O que este documento **não** prova. Nunca vazio — ver `limitacoes`. */
  limitacoes: string[]
}

/** Estados que não ocupam nem geram obrigação de boletim. */
const IRRELEVANTES = ['cancelada', 'no_show']

/**
 * Estadias do período, pela ordem em que aconteceram.
 *
 * O critério é a **entrada** dentro do período, e não a sobreposição: a
 * obrigação de comunicar nasce da entrada do hóspede, portanto é a entrada que
 * decide a que período a estadia pertence. Uma reserva de 28 de dezembro a 3 de
 * janeiro conta para dezembro, uma vez só.
 */
export function reservasDoPeriodo(
  reservas: ReservaDossie[],
  de: string,
  ate: string,
): ReservaDossie[] {
  return reservas
    .filter(r => !IRRELEVANTES.includes(r.estado ?? ''))
    .filter(r => r.check_in >= de && r.check_in <= ate)
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || a.id.localeCompare(b.id))
}

export function linhasDeComunicacao(reservas: ReservaDossie[], hoje: string): LinhaComunicacao[] {
  return reservas.map(r => {
    const resumo = estadoSiba(r)
    return {
      bookingId: r.id,
      check_in: r.check_in,
      check_out: r.check_out ?? null,
      pessoas: r.num_hospedes ?? 1,
      estado: resumo.texto,
      detalhe: resumo.detalhe,
      emAtraso: estaEmAtraso(r, hoje),
    }
  })
}

export function resumirComunicacao(reservas: ReservaDossie[], hoje: string): ResumoComunicacao {
  let comunicadas = 0
  let porComunicar = 0
  let falhadas = 0
  let emAtraso = 0

  for (const r of reservas) {
    const chave = estadoSiba(r).chave
    if (chave === 'submetido') comunicadas++
    else if (chave === 'falhou') falhadas++
    else porComunicar++

    if (estaEmAtraso(r, hoje)) emAtraso++
  }

  return { reservas: reservas.length, comunicadas, porComunicar, falhadas, emAtraso }
}

/**
 * O que este documento não prova.
 *
 * Escrito sempre, e nunca vazio: a primeira limitação vale em todos os casos, e
 * é a que impede o dossiê de ser lido como uma certificação. As restantes só
 * aparecem quando se aplicam — uma lista de ressalvas genéricas que ninguém lê
 * não protege ninguém.
 */
export function limitacoes(p: {
  estabelecimento: EstabelecimentoDossie
  conformidade: ItemConformidade[]
  comunicacao: ResumoComunicacao
  temSubmissoes: boolean
}): string[] {
  const notas: string[] = [
    'Este documento é gerado pelo próprio titular a partir dos seus registos. Não é emitido, validado nem reconhecido por nenhuma entidade oficial.',
  ]

  const emFalta = p.conformidade.filter(i => i.obrigatorio && (i.estado === 'em_falta' || i.estado === 'expirado'))
  if (emFalta.length > 0) {
    notas.push(
      `${emFalta.length === 1 ? 'Há uma obrigação' : `Há ${emFalta.length} obrigações`} por cumprir à data de emissão: ${emFalta.map(i => i.titulo).join(', ')}.`,
    )
  }

  /* Os documentos em si não vivem cá. O que a app guarda são os números e as
   * datas que o anfitrião introduziu — a apólice e o certificado continuam a
   * ser precisos em papel ou em ficheiro. Dizê-lo evita a leitura de que
   * imprimir isto substitui levá-los. */
  notas.push(
    'Os documentos originais (apólice de seguro, certificado energético, título de registo) não são guardados nesta aplicação: aqui constam os números e as datas introduzidos pelo titular, que não substituem os documentos.',
  )

  if (p.comunicacao.porComunicar > 0 || p.comunicacao.falhadas > 0) {
    notas.push(
      `${p.comunicacao.porComunicar + p.comunicacao.falhadas} de ${p.comunicacao.reservas} estadias do período não têm comunicação registada como entregue.`,
    )
  }

  if (!p.temSubmissoes && p.comunicacao.reservas > 0) {
    notas.push(
      'Não há registos de envio ao SIBA para este período. As comunicações que tenham sido feitas fora desta aplicação não constam aqui.',
    )
  }

  if (!p.estabelecimento.siba_nipc) {
    notas.push(
      'A unidade não tem credenciais do SIBA configuradas nesta aplicação, pelo que nenhuma comunicação foi feita por aqui.',
    )
  }

  /* O dossiê conta o que foi comunicado; não decide quem tinha de o ser. É uma
   * distinção que interessa manter porque a app não a faz — comunica o que lhe
   * mandam comunicar — e afirmar o contrário seria dar por resolvida uma
   * pergunta jurídica que ninguém aqui respondeu. */
  notas.push(
    'O quadro seguinte diz o que foi comunicado, e não quem estava obrigado a sê-lo — a determinação de quais hóspedes carecem de boletim de alojamento não é feita por esta aplicação.',
  )

  return notas
}

/** Monta o dossiê completo. Determinístico: `hoje` e `emitidoEm` entram por fora. */
export function montarDossie(p: {
  estabelecimento: EstabelecimentoDossie & CamposConformidade
  reservas: ReservaDossie[]
  submissoes: SubmissaoDossie[]
  de: string
  ate: string
  hoje: string
  emitidoEm: string
}): Dossie {
  const doPeriodo = reservasDoPeriodo(p.reservas, p.de, p.ate)
  const conformidade = avaliarConformidade(p.estabelecimento, p.hoje)
  const comunicacao = resumirComunicacao(doPeriodo, p.hoje)

  /* As submissões do período, pela data de envio e da mais recente para a mais
   * antiga: quem consulta isto procura a última, não a primeira. */
  const submissoes = [...p.submissoes]
    .filter(s => s.criado_em.slice(0, 10) >= p.de && s.criado_em.slice(0, 10) <= p.ate)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))

  return {
    emitidoEm: p.emitidoEm,
    periodo: { de: p.de, ate: p.ate },
    estabelecimento: p.estabelecimento,
    conformidade,
    resumoConformidade: resumirConformidade(conformidade),
    comunicacao,
    linhas: linhasDeComunicacao(doPeriodo, p.hoje),
    submissoes,
    limitacoes: limitacoes({
      estabelecimento: p.estabelecimento,
      conformidade,
      comunicacao,
      temSubmissoes: submissoes.length > 0,
    }),
  }
}
