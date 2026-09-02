import type { IcalFeed, BookingSource } from './types'

/**
 * Estado de uma ligação a um canal, tal como o anfitrião a vê.
 *
 * Vive aqui e não no JSX porque é a mesma pergunta feita em três sítios — a
 * página de canais, o cartão do alojamento e o aviso do calendário — e porque
 * a regra de "desatualizado" é uma conta com horas que se tem de poder testar.
 */
export type EstadoCanal =
  | 'nao_configurado'
  | 'por_sincronizar'
  | 'ligado'
  | 'desatualizado'
  | 'erro'

/**
 * O cron corre uma vez por dia, às 04:00 (ver vercel.json). Um feed que passou
 * mais de 36 horas sem uma sincronização com sucesso falhou pelo menos uma
 * passagem — e falhou **em silêncio**, que é o modo de falha caro: o
 * calendário continua a mostrar o que sabia ontem e o anfitrião vende por cima
 * de uma reserva que já existe do outro lado.
 */
export const HORAS_ATE_DESATUALIZADO = 36

export interface DescricaoEstado {
  /** Rótulo curto, para o crachá. */
  label: string
  /** Uma frase que diz o que se passa e, quando há, o que fazer a seguir. */
  explicacao: string
  /** Cor semântica: 'verde' | 'ambar' | 'vermelho' | 'neutro'. */
  tom: 'verde' | 'ambar' | 'vermelho' | 'neutro'
}

export const ESTADO_CANAL: Record<EstadoCanal, DescricaoEstado> = {
  nao_configurado: {
    label: 'Não configurado',
    explicacao:
      'Ainda não ligaste este canal. As reservas que receberes lá não aparecem aqui e as datas ocupadas aqui não bloqueiam lá.',
    tom: 'neutro',
  },
  por_sincronizar: {
    label: 'Por sincronizar',
    explicacao:
      'O endereço está guardado mas ainda não foi lido nenhuma vez. Carrega em «Sincronizar agora» para trazer as reservas.',
    tom: 'ambar',
  },
  ligado: {
    label: 'Ligado',
    explicacao:
      'A funcionar. As reservas desta plataforma são trazidas todos os dias de madrugada e bloqueiam as datas no teu calendário.',
    tom: 'verde',
  },
  desatualizado: {
    label: 'Desatualizado',
    explicacao:
      'Já passou mais de um dia desde a última leitura com sucesso. Pode ter sido uma falha passageira da plataforma — sincroniza agora para confirmar.',
    tom: 'ambar',
  },
  erro: {
    label: 'Erro',
    explicacao:
      'A última tentativa falhou. Enquanto não for resolvido, as reservas novas desta plataforma não chegam aqui.',
    tom: 'vermelho',
  },
}

/**
 * Estado de um feed. `agora` entra por parâmetro para o teste não depender do
 * relógio da máquina que o corre.
 */
export function estadoDoFeed(feed: IcalFeed, agora: Date = new Date()): EstadoCanal {
  if (feed.error) return 'erro'
  if (!feed.last_sync) return 'por_sincronizar'

  const ultima = new Date(feed.last_sync).getTime()
  // Uma data ilegível é indistinguível de nunca ter sincronizado — e é melhor
  // pedir uma sincronização a mais do que dar um verde que não se confirmou.
  if (Number.isNaN(ultima)) return 'por_sincronizar'

  const horas = (agora.getTime() - ultima) / 3_600_000
  return horas > HORAS_ATE_DESATUALIZADO ? 'desatualizado' : 'ligado'
}

/**
 * Estado de um alojamento inteiro: o pior dos seus feeds.
 *
 * Um verde ao lado do alojamento quando um dos três feeds está em erro é pior
 * do que não ter crachá nenhum — esconde exatamente aquilo que se precisa de
 * ver.
 */
const GRAVIDADE: Record<EstadoCanal, number> = {
  erro: 4,
  desatualizado: 3,
  por_sincronizar: 2,
  ligado: 1,
  nao_configurado: 0,
}

export function estadoDoAlojamento(feeds: IcalFeed[], agora: Date = new Date()): EstadoCanal {
  if (feeds.length === 0) return 'nao_configurado'
  return feeds
    .map(f => estadoDoFeed(f, agora))
    .reduce((pior, e) => (GRAVIDADE[e] > GRAVIDADE[pior] ? e : pior), 'ligado' as EstadoCanal)
}

/**
 * Traduz a mensagem técnica que ficou guardada no feed para uma frase que diz
 * ao anfitrião o que fazer.
 *
 * O que estava guardado em `feed.error` era o `err.message` cru — «Upstream
 * devolveu 404», «The operation was aborted due to timeout». São verdadeiras e
 * não servem para nada a quem não escreveu o código: não dizem se a culpa é
 * do endereço, da plataforma ou da rede, nem o que se faz a seguir.
 */
export function erroAmigavel(bruto: string): string {
  const e = bruto.toLowerCase()

  // Recusas da allowlist já vêm escritas para humanos (ver ical-fetch.ts).
  if (e.includes('não está na lista') || e.includes('tem de começar por https')
    || e.includes('url inválido')) {
    return bruto
  }

  if (e.includes('404') || e.includes('410')) {
    return 'A plataforma respondeu que este calendário já não existe. Costuma acontecer quando o anúncio foi apagado ou quando a plataforma gerou um endereço novo — volta lá, copia o endereço atual e substitui este.'
  }
  if (e.includes('401') || e.includes('403') || e.includes('redirect')) {
    return 'A plataforma recusou o acesso a este calendário. O endereço pode ter sido revogado — gera um novo na plataforma e substitui este.'
  }
  if (e.includes('429')) {
    return 'A plataforma está a recusar leituras por serem demasiado seguidas. Espera uma hora; a sincronização automática de madrugada volta a tentar sozinha.'
  }
  if (e.includes('50') && e.includes('upstream')) {
    return 'A plataforma teve um erro do lado dela. Não há nada a corrigir aqui — a sincronização automática volta a tentar de madrugada.'
  }
  if (e.includes('timeout') || e.includes('aborted')) {
    return 'A plataforma demorou demasiado a responder. Costuma ser passageiro — tenta sincronizar outra vez daqui a uns minutos.'
  }
  if (e.includes('demasiado grande')) {
    return 'O calendário é demasiado grande para ser lido. Se usas um gestor de canais, liga o endereço de cada quarto em vez do da casa toda.'
  }
  if (e.includes('fetch failed') || e.includes('network') || e.includes('enotfound')) {
    return 'Não foi possível chegar à plataforma. Confirma que o endereço está completo e correto.'
  }

  return `A leitura falhou: ${bruto}`
}

/**
 * O que o iCal transporta, e o que não transporta.
 *
 * É a pergunta que mais custa não ter respondida: quem liga um calendário
 * assume que ligou a plataforma inteira, e só descobre que os preços não
 * viajam quando vende uma noite de agosto ao preço de fevereiro.
 */
export const O_QUE_SINCRONIZA = [
  'As datas ocupadas por reservas feitas na plataforma.',
  'As datas que bloqueaste manualmente na plataforma.',
  'Alterações de datas de uma reserva já importada.',
  'Cancelamentos — a reserva é marcada como cancelada e a data volta a ficar livre.',
]

export const O_QUE_NAO_SINCRONIZA = [
  'Preços. Continuam a definir-se em cada plataforma, uma a uma.',
  'Estadia mínima e máxima, e restrições de dia de chegada ou de saída.',
  'Nome, contacto e dados do hóspede — o iCal não os transporta.',
  'Valores pagos, comissões e faturação.',
  'Mensagens e avaliações.',
]

/**
 * Nomes das plataformas que se oferecem como canal de importação.
 * `direto` fica de fora: é a origem das reservas do teu próprio site, não um
 * calendário que se vá buscar a lado nenhum.
 *
 * **O gestor de canais vem primeiro, e não por ordem alfabética.** Quem tem um
 * Amenitiz ou um Smoobu tem de o escolher *a ele* e a mais nada — as reservas
 * do Airbnb e do Booking já vêm lá dentro, e ligar os dois caminhos duplica-as
 * (`deveAvisarDuplicacao`). Estando em último, a seguir a quatro OTA, a opção
 * certa era a última a ser vista por quem mais precisa dela: a lista parecia
 * dizer que a app só fala com plataformas.
 */
export const CANAIS_IMPORTAVEIS: Exclude<BookingSource, 'direto'>[] = [
  'outro',
  'airbnb',
  'booking',
  'expedia',
  'vrbo',
]
