/**
 * Verificador do número de registo de Alojamento Local (RNAL).
 *
 * **O que isto verifica, e o que não verifica.** Verifica a *forma* do número:
 * que é uma sequência de dígitos seguida de `/AL`, que é isso que sai do Balcão
 * Único Eletrónico e que é isso que as plataformas leem. **Não** confirma que o
 * número existe no Registo Nacional de Alojamento Local, nem que está ativo, nem
 * que pertence a este alojamento — não há serviço público que o permita
 * consultar. Um número bem formado pode ser de outra pessoa ou já ter caducado.
 *
 * Porque é que a forma importa, mesmo assim: o número vai para a publicidade
 * (DL 128/2014, art. 18.º), para o cartaz do livro de reclamações, para o dossiê
 * e para os anúncios nas plataformas. O Regulamento (UE) 2024/1028 obriga as
 * plataformas de arrendamento de curta duração a verificarem automaticamente os
 * números de registo que os anfitriões declaram e a suspenderem anúncios com
 * números que falhem a verificação. Um `12345 AL` escrito à pressa passa hoje
 * sem ninguém dar por isso na aplicação e reaparece como anúncio suspenso.
 */

/** Motivo pelo qual um número não passa na verificação. */
export type MotivoRnal =
  | 'vazio'
  | 'sem_numero'
  | 'caracteres_invalidos'
  | 'numero_zero'
  | 'demasiado_longo'

export interface ResultadoRnal {
  valido: boolean
  /** Forma canónica (`12345/AL`) quando é possível chegar a uma. */
  normalizado: string | null
  motivo?: MotivoRnal
  /** Frase pronta para a interface. Vazia quando é válido. */
  mensagem: string
}

/**
 * Maior número de dígitos aceite. O RNAL ronda hoje as seis casas; dez dá folga
 * para décadas sem deixar passar um NIF ou um IBAN colado por engano.
 */
export const MAX_DIGITOS_RNAL = 10

const MENSAGENS: Record<MotivoRnal, string> = {
  vazio: 'Sem número de registo.',
  sem_numero: 'Não se encontra nenhum número. O registo tem a forma 12345/AL.',
  caracteres_invalidos:
    'O número tem caracteres a mais. O registo é só dígitos seguidos de /AL (ex.: 12345/AL).',
  numero_zero: 'O número de registo não pode ser zero.',
  demasiado_longo: `O número tem mais de ${MAX_DIGITOS_RNAL} dígitos — não parece um número de registo.`,
}

/**
 * Reduz um número escrito à mão à forma canónica `12345/AL`.
 *
 * Aceita o que os anfitriões realmente escrevem: `12345`, `12345/AL`,
 * `12345 AL`, `AL 12345`, `n.º 12345/AL`, com espaços, minúsculas, hífens ou
 * pontos de milhar. Devolve `null` quando não sobra um número utilizável — aí
 * quem chama decide o que fazer.
 *
 * Não inventa: se houver texto que não seja o número, o prefixo `AL` ou
 * pontuação comum, devolve `null` em vez de deitar fora o que não percebeu.
 */
export function normalizarRnal(bruto: string | null | undefined): string | null {
  if (!bruto) return null

  const limpo = bruto.trim()
  if (limpo === '') return null

  // Ruído tipográfico à volta do número: o "n.º"/"nº"/"no" e o prefixo/sufixo
  // AL em qualquer caixa — mas só nas pontas. Apagar «AL» em qualquer posição
  // cosia `12345 AL 2024` num 123452024 inventado: o AL virava espaço e os
  // espaços internos contam como separadores de milhar.
  const semRuido = limpo
    .replace(/n\.?[ºo°]\.?/gi, ' ')
    .replace(/^[\s/\\.-]*a\.?\s*l\.?(?=[\d\s/\\.-]|$)/i, ' ')
    .replace(/(?<=[\d\s/\\.-])a\.?\s*l\.?[\s/\\.-]*$/i, ' ')

  /* O que pode sobrar é **um** grupo de dígitos, com pontos ou espaços de
   * milhar lá dentro, rodeado de barras e espaços. Deliberadamente não se
   * apagam separadores em bloco: `12345/AL/2024` viraria `123452024/AL`, que é
   * um número inventado com ar de bom — o pior resultado possível para um campo
   * que acaba na publicidade. Dois grupos de dígitos não passam. */
  const m = semRuido.match(/^[\s/\\-]*(\d[\d.\s]*?)[\s/\\-]*$/)
  if (!m) return null

  // Zeros à esquerda são erro de transcrição, não parte do número.
  const digitos = m[1].replace(/[.\s]/g, '').replace(/^0+(?=\d)/, '')
  return `${digitos}/AL`
}

/**
 * Verifica um número de registo e devolve a forma canónica quando passa.
 *
 * Um número em branco dá `vazio` — que não é a mesma coisa que estar errado. O
 * cofre de conformidade trata a ausência como «em falta» e a forma errada como
 * «inválido», porque as duas se resolvem de maneiras diferentes: uma pede o
 * registo, a outra pede uma correção.
 */
export function verificarRnal(bruto: string | null | undefined): ResultadoRnal {
  const limpo = (bruto ?? '').trim()
  if (limpo === '') {
    return { valido: false, normalizado: null, motivo: 'vazio', mensagem: MENSAGENS.vazio }
  }

  const normalizado = normalizarRnal(limpo)
  if (normalizado === null) {
    // Distingue «não há cá dígitos nenhuns» de «há dígitos mas também há lixo»,
    // porque a correção que se pede ao anfitrião é diferente.
    const motivo: MotivoRnal = /\d/.test(limpo) ? 'caracteres_invalidos' : 'sem_numero'
    return { valido: false, normalizado: null, motivo, mensagem: MENSAGENS[motivo] }
  }

  const digitos = normalizado.slice(0, -3)

  if (digitos === '0') {
    return {
      valido: false,
      normalizado: null,
      motivo: 'numero_zero',
      mensagem: MENSAGENS.numero_zero,
    }
  }

  if (digitos.length > MAX_DIGITOS_RNAL) {
    return {
      valido: false,
      normalizado: null,
      motivo: 'demasiado_longo',
      mensagem: MENSAGENS.demasiado_longo,
    }
  }

  return { valido: true, normalizado, mensagem: '' }
}

/**
 * O que gravar na base a partir do que o anfitrião escreveu.
 *
 * Grava a forma canónica quando o número passa, e o texto tal e qual quando não
 * passa — recusar a gravação trancava o anfitrião fora do formulário por causa
 * de um formato que podemos não conhecer, e apagar o que ele escreveu era pior.
 * O erro fica visível no cofre em vez de desaparecer.
 */
export function rnalParaGravar(bruto: string | null | undefined): string | null {
  const limpo = (bruto ?? '').trim()
  if (limpo === '') return null
  return verificarRnal(limpo).normalizado ?? limpo
}
