import type { SerieExistente } from './types'

/**
 * Regras para ligar uma conta de faturação que o anfitrião **já tinha**.
 *
 * Quem vem do Amenitiz (ou de qualquer outro programa) costuma ter uma conta
 * InvoiceXpress com série registada na AT e dezenas de faturas emitidas.
 * Criar-lhe uma conta nova partia a faturação do mesmo NIF em duas contas e
 * duas séries. Ligar a existente mantém a numeração onde está.
 *
 * Funções puras, sem rede nem base — o que grava está em `contas.ts`.
 */

/** Subdomínios InvoiceXpress: letras, dígitos e hífen. */
const SUBDOMINIO_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * Aceita o que o anfitrião tiver à mão — o nome da conta ou o endereço que vê
 * no browser, que é `<conta>.web.invoicexpress.com/...` na aplicação e
 * `<conta>.app.invoicexpress.com` na API — e devolve só o subdomínio.
 */
export function normalizarSubdominio(entrada: string): string | null {
  let s = entrada.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^https?:\/\//, '')
  if (s.includes('invoicexpress.com')) {
    s = s.split('.')[0]
  } else {
    s = s.split(/[/?#]/)[0]
  }
  // Os subdomínios da própria plataforma não são contas de ninguém.
  if (['www', 'app', 'web', 'api'].includes(s)) return null
  return SUBDOMINIO_RE.test(s) ? s : null
}

/**
 * A série onde o Anfitrião vai emitir: a série padrão da conta, se estiver
 * registada na AT; senão a registada com mais faturas-recibo, que é a que o
 * anfitrião tem estado a usar. Null quando nenhuma está registada — aí o
 * passo da AT cria uma.
 */
export function escolherSerie(series: SerieExistente[]): SerieExistente | null {
  const comunicadas = series.filter(s => s.comunicada)
  if (comunicadas.length === 0) return null
  const padrao = comunicadas.find(s => s.padrao)
  if (padrao) return padrao
  return [...comunicadas].sort((a, b) => b.ultimaFaturaRecibo - a.ultimaFaturaRecibo)[0]
}
