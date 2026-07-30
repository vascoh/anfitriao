import { addDays } from './utils'

/**
 * Política de retenção de dados pessoais — aplicada por código, não prometida
 * em prosa (RGPD art. 5.º n.º 1 al. e, limitação da conservação).
 *
 * Lógica pura e testável: o cron `/api/cron/retencao`, a rota de apagamento a
 * pedido e a página de privacidade leem os prazos daqui, para a promessa
 * pública e o comportamento real não poderem divergir.
 *
 * O que se faz é **anonimizar**, não apagar a linha do hóspede: a reserva é
 * também um registo com relevância fiscal e apagar o hóspede partiria a
 * cadeia. Anonimizar cumpre o art. 17.º na parte que nos compete — dados
 * anonimizados deixam de ser dados pessoais (cons. 26) — e deixa de pé os
 * números de que o anfitrião precisa (receita, ocupação, noites).
 *
 * Enquadramento (referência, não aconselhamento jurídico):
 * - **Boletim de alojamento** (documento, nascimento, sexo, nacionalidade):
 *   recolhido ao abrigo da Lei 23/2007 art. 16.º para comunicação às
 *   autoridades. Cumprido esse fim, deixa de haver fundamento para o guardar
 *   — daí o prazo curto.
 * - **Contacto** (nome, email, telefone): fica mais tempo por interesse
 *   legítimo do anfitrião (art. 6.º n.º 1 al. f) — hóspede repetente, prova de
 *   uma estadia, resposta a reclamação.
 * - **Dados fiscais** (valores, datas, faturas): 10 anos, art. 52.º do CIVA.
 *   **Nunca** são tocados por esta política; é obrigação legal conservá-los.
 */

export interface Prazo {
  dias: number
  /** Mostrado ao anfitrião e na política de privacidade. */
  base: string
}

export const PRAZOS = {
  /** Campos do boletim de alojamento, a contar da saída do hóspede. */
  boletim: {
    dias: 365,
    base: 'Lei 23/2007, art. 16.º — recolhidos para comunicação às autoridades; cumprido esse fim, deixam de ser necessários.',
  },
  /** Nome, email e telefone, a contar da última saída. */
  contacto: {
    dias: 3 * 365,
    base: 'Interesse legítimo do anfitrião (RGPD art. 6.º n.º 1 al. f) — hóspede repetente e prova da estadia.',
  },
} as const satisfies Record<string, Prazo>

/**
 * Conservação dos dados com relevância fiscal, para efeitos de documentação.
 * Não é usada por nenhuma rotina de apagamento — está aqui para o número
 * mostrado na política de privacidade vir do mesmo sítio que os outros.
 */
export const PRAZO_FISCAL = {
  anos: 10,
  base: 'Art. 52.º do CIVA — arquivo e conservação de faturas e documentos fiscais.',
} as const

export type GrupoDados = keyof typeof PRAZOS

/** Campos do boletim de alojamento em `guests`. */
export const CAMPOS_BOLETIM = [
  'numero_documento',
  'tipo_documento',
  'data_validade_doc',
  'pais_emissao',
  'data_nascimento',
  'sexo',
  'nacionalidade',
] as const

/** Campos de contacto em `guests`. */
export const CAMPOS_CONTACTO = ['email', 'telefone'] as const

/** Substitui o nome — não se apaga para o histórico não ficar com linhas vazias. */
export const NOME_ANONIMO = 'Hóspede anonimizado'

export interface EstadoRetencao {
  /** Grupos cujo prazo já passou e que devem ser anonimizados hoje. */
  grupos: GrupoDados[]
  /** Data a partir da qual cada grupo expira (undefined = ainda indeterminada). */
  expiraEm: Partial<Record<GrupoDados, string>>
}

/**
 * Decide o que já não pode ser conservado de um hóspede.
 *
 * `ultimaSaida` é o check-out mais recente das reservas dele; quando não tem
 * nenhuma, usa-se a data de criação do registo. Uma reserva futura ou a
 * decorrer adia tudo: o prazo conta-se **da saída**, e um hóspede que volta
 * reinicia a contagem.
 *
 * @param ultimaSaida `YYYY-MM-DD` do último check-out, ou null se não houver reservas
 * @param criadoEm    `YYYY-MM-DD` em que o hóspede foi criado (fallback)
 * @param hoje        `YYYY-MM-DD`
 */
export function avaliarRetencao(
  ultimaSaida: string | null,
  criadoEm: string | null,
  hoje: string,
): EstadoRetencao {
  const referencia = ultimaSaida ?? criadoEm
  if (!referencia) return { grupos: [], expiraEm: {} }

  // Uma saída no futuro (reserva por cumprir) não inicia contagem nenhuma.
  if (referencia > hoje) return { grupos: [], expiraEm: {} }

  const grupos: GrupoDados[] = []
  const expiraEm: Partial<Record<GrupoDados, string>> = {}

  for (const grupo of Object.keys(PRAZOS) as GrupoDados[]) {
    const limite = addDays(referencia, PRAZOS[grupo].dias)
    expiraEm[grupo] = limite
    if (hoje >= limite) grupos.push(grupo)
  }

  return { grupos, expiraEm }
}

/**
 * Campos a escrever em `guests` para anonimizar os grupos indicados.
 * Devolve `{}` quando não há nada a fazer — quem chama deve saltar o UPDATE.
 */
export function camposAnonimizacao(grupos: GrupoDados[]): Record<string, string | null> {
  const campos: Record<string, string | null> = {}

  if (grupos.includes('boletim')) {
    for (const campo of CAMPOS_BOLETIM) campos[campo] = null
  }

  if (grupos.includes('contacto')) {
    for (const campo of CAMPOS_CONTACTO) campos[campo] = null
    campos.nome = NOME_ANONIMO
    // Notas e etiquetas são texto livre do anfitrião sobre a pessoa: sem o
    // contacto, deixam de ter para quem servir e podem conter dados pessoais.
    campos.notas = null
  }

  return campos
}

/** Todos os grupos — usado pelo apagamento a pedido (art. 17.º), que não espera prazos. */
export const TODOS_OS_GRUPOS = Object.keys(PRAZOS) as GrupoDados[]

/** Texto do prazo para interfaces e política de privacidade (ex.: "1 ano", "3 anos"). */
export function descreverPrazo(dias: number): string {
  if (dias % 365 === 0) {
    const anos = dias / 365
    return anos === 1 ? '1 ano' : `${anos} anos`
  }
  if (dias % 30 === 0) {
    const meses = dias / 30
    return meses === 1 ? '1 mês' : `${meses} meses`
  }
  return `${dias} dias`
}
