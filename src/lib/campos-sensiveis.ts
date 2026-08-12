import 'server-only'
import { encriptar, decifrar, pareceEncriptado, estaConfigurada } from './crypto'

/**
 * Encriptação em repouso dos campos de documento de identificação (ANF-1.7).
 *
 * ## O que se encripta, e porquê só isto
 *
 * `numero_documento` e `data_validade_doc` — o par que identifica o documento
 * de uma pessoa. É o que transforma uma fuga de base de dados numa fuga com
 * consequência: com nome e número de documento abre-se crédito, aluga-se
 * carro, faz-se check-in noutro sítio. O nome sozinho não faz nada disso.
 *
 * Ficam **em claro** de propósito: `nome`, `nacionalidade`, `data_nascimento`,
 * `sexo`, `pais_emissao`, `tipo_documento`. Não por serem menos privados —
 * são dados pessoais na mesma e estão cobertos pela política de retenção
 * (`lib/retencao.ts`) — mas porque a app filtra, ordena e agrupa por eles, e
 * um campo encriptado deixa de ser pesquisável na base. Encriptar tudo daria
 * a mesma proteção real (quem tem a base tem os nomes na mesma, via
 * `bookings`) ao preço de partir metade da aplicação.
 *
 * ## Como se comporta quando não há chave
 *
 * Em produção, escrever **falha**: guardar um número de documento em claro
 * porque a `APP_ENCRYPTION_KEY` não estava definida é exatamente a situação
 * que isto existe para evitar, e falhar alto é a única forma de não a
 * repetir em silêncio. Em desenvolvimento e nos testes guarda-se em claro
 * com aviso — a alternativa era não haver check-in numa máquina local.
 *
 * ## Leitura
 *
 * `revelar` aceita valores em claro sem se queixar: linhas escritas antes
 * desta mudança continuam a ler-se, e não é preciso migração nem paragem.
 * Um valor que **parece** encriptado mas não decifra devolve `null` em vez de
 * rebentar — uma linha corrompida não pode derrubar a página inteira, e o
 * erro fica no log com o campo identificado.
 */

/** Campos de `guests` guardados encriptados. */
export const CAMPOS_SENSIVEIS = ['numero_documento', 'data_validade_doc'] as const

export type CampoSensivel = (typeof CAMPOS_SENSIVEIS)[number]

let avisoDado = false

function emProducao(): boolean {
  return process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production'
}

function avisarUmaVez(): void {
  if (avisoDado) return
  avisoDado = true
  console.warn(
    '[campos-sensiveis] APP_ENCRYPTION_KEY não está definida: os campos de ' +
    'documento são guardados em claro. Normal em desenvolvimento e CI.',
  )
}

/**
 * Prepara um objeto de hóspede para escrita, encriptando os campos de
 * documento que traga. Idempotente: um valor já encriptado passa intacto,
 * para o mesmo objeto poder ser reescrito sem cifrar duas vezes.
 *
 * Lança em produção se não houver chave — quem chama não deve apanhar o erro,
 * deve deixá-lo subir e responder 500. Meio hóspede guardado é melhor do que
 * um número de documento em claro.
 */
export function protegerCampos<T extends Record<string, unknown>>(dados: T): T {
  const temChave = estaConfigurada()

  if (!temChave) {
    const traz = CAMPOS_SENSIVEIS.some(c => typeof dados[c] === 'string' && dados[c])
    if (traz && emProducao()) {
      throw new Error(
        'APP_ENCRYPTION_KEY não está definida em produção: recusado guardar ' +
        'campos de documento em claro.',
      )
    }
    if (traz) avisarUmaVez()
    return dados
  }

  const saida = { ...dados }
  for (const campo of CAMPOS_SENSIVEIS) {
    const valor = saida[campo]
    if (typeof valor !== 'string' || !valor) continue
    if (pareceEncriptado(valor)) continue
    ;(saida as Record<string, unknown>)[campo] = encriptar(valor)
  }
  return saida
}

/**
 * Devolve uma linha de hóspede legível. Valores em claro (anteriores à
 * encriptação) passam tal como estão; valores ilegíveis passam a `null`.
 */
export function revelarCampos<T extends Record<string, unknown>>(linha: T): T
export function revelarCampos<T extends Record<string, unknown>>(linha: T | null): T | null
export function revelarCampos<T extends Record<string, unknown>>(linha: T | null): T | null {
  if (!linha) return linha

  let copiada: Record<string, unknown> | null = null

  for (const campo of CAMPOS_SENSIVEIS) {
    const valor = linha[campo]
    if (typeof valor !== 'string' || !pareceEncriptado(valor)) continue

    copiada ??= { ...linha }
    try {
      copiada[campo] = decifrar(valor)
    } catch (err) {
      console.error(
        `[campos-sensiveis] não foi possível decifrar "${campo}"`,
        err instanceof Error ? err.message : err,
      )
      copiada[campo] = null
    }
  }

  return (copiada ?? linha) as T
}

/**
 * `revelarCampos` sobre uma lista. Tolera null/undefined e listas vazias
 * tipadas como `never[]` — é a forma que o `data` do Supabase toma quando o
 * ramo "sem ids para procurar" devolve `{ data: [] }`.
 */
export function revelarLista<T>(linhas: readonly T[] | null | undefined): T[] {
  return (linhas ?? []).map(l =>
    l && typeof l === 'object'
      ? (revelarCampos(l as Record<string, unknown>) as unknown as T)
      : l,
  )
}
