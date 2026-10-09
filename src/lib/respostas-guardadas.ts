/**
 * Respostas guardadas da caixa de entrada — regras puras.
 *
 * Um modelo é texto com variáveis entre chavetas (`{nome}`, `{checkin}`, …),
 * preenchidas com os dados da conversa aberta. Uma variável sem valor (a
 * conversa não tem reserva, o alojamento não tem instruções) não desaparece:
 * vira `[confirmar: …]`, e a caixa de entrada já não deixa enviar enquanto
 * houver uma dessas marcas. Desaparecer em silêncio era mandar ao hóspede
 * «o check-in é a » sem ninguém reparar.
 */

export const LIMITE_TITULO = 80
export const LIMITE_MODELO = 5000
export const MAX_RESPOSTAS = 100

export interface RespostaGuardada {
  id: string
  titulo: string
  corpo: string
}

export const VARIAVEIS = {
  nome: 'nome do hóspede',
  primeiro_nome: 'primeiro nome do hóspede',
  propriedade: 'alojamento',
  checkin: 'data de chegada',
  checkout: 'data de saída',
  noites: 'número de noites',
  morada: 'morada do alojamento',
  instrucoes_checkin: 'instruções de chegada',
  regras_casa: 'regras da casa',
  link_checkin: 'link do check-in online',
} as const

export type Variavel = keyof typeof VARIAVEIS
export type ValoresVariaveis = Partial<Record<Variavel, string | null>>

export function preencherModelo(modelo: string, valores: ValoresVariaveis): string {
  return modelo.replace(/\{([a-z_]+)\}/g, (inteiro, chave: string) => {
    if (!Object.hasOwn(VARIAVEIS, chave)) return inteiro
    const v = valores[chave as Variavel]?.trim()
    return v ? v : `[confirmar: ${VARIAVEIS[chave as Variavel]}]`
  })
}

/** Variáveis escritas no modelo que não existem — quase sempre um erro de escrita. */
export function variaveisDesconhecidas(modelo: string): string[] {
  const achadas = [...modelo.matchAll(/\{([a-z_]+)\}/g)].map(m => m[1])
  return [...new Set(achadas.filter(c => !Object.hasOwn(VARIAVEIS, c)))]
}

export function validarResposta(titulo: unknown, corpo: unknown): { titulo: string; corpo: string } | { erro: string } {
  const t = typeof titulo === 'string' ? titulo.trim() : ''
  const c = typeof corpo === 'string' ? corpo.trim() : ''
  if (!t) return { erro: 'Dá um nome à resposta.' }
  if (t.length > LIMITE_TITULO) return { erro: `O nome tem no máximo ${LIMITE_TITULO} caracteres.` }
  if (!c) return { erro: 'A resposta está vazia.' }
  if (c.length > LIMITE_MODELO) return { erro: `A resposta tem no máximo ${LIMITE_MODELO} caracteres.` }
  const desconhecidas = variaveisDesconhecidas(c)
  if (desconhecidas.length) {
    return { erro: `Variável desconhecida: ${desconhecidas.map(d => `{${d}}`).join(', ')}.` }
  }
  return { titulo: t, corpo: c }
}

/** Mostrados enquanto o anfitrião não guardou nenhuma — um ponto de partida, não dados. */
export const EXEMPLOS: Array<Omit<RespostaGuardada, 'id'>> = [
  {
    titulo: 'Instruções de chegada',
    corpo: 'Olá {primeiro_nome}!\n\nFalta pouco para a sua estadia em {propriedade} ({checkin} – {checkout}).\n\n{instrucoes_checkin}\n\nAntes de chegar, faça por favor o check-in online: {link_checkin}\n\nAté breve!',
  },
  {
    titulo: 'Check-in online em falta',
    corpo: 'Olá {primeiro_nome}, ainda não recebemos o seu check-in online. A lei obriga-nos a comunicar os dados de cada hóspede — demora poucos minutos: {link_checkin}\n\nObrigado!',
  },
  {
    titulo: 'Check-out',
    corpo: 'Olá {primeiro_nome}, esperamos que a estadia esteja a correr bem. Lembramos que o check-out é a {checkout}.\n\n{regras_casa}\n\nBoa viagem!',
  },
]
