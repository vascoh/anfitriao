import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Encriptação simétrica de segredos guardados na base de dados.
 *
 * Existe por causa da chave de acesso ao SIBA, que é uma credencial do
 * anfitrião perante o Estado: quem a tiver submete boletins em nome dele. Mas
 * serve o mesmo propósito para os campos de documento de identificação dos
 * hóspedes (ANF-1.7), que é o passo seguinte.
 *
 * AES-256-GCM: cifra e autentica ao mesmo tempo. Sem a etiqueta de
 * autenticação a decifra falha, o que significa que um valor adulterado na
 * base de dados é detetado em vez de devolvido em silêncio.
 *
 * A chave vive em `APP_ENCRYPTION_KEY` (32 bytes em Base64, gerada com
 * `openssl rand -base64 32`). **Sem ela nada é encriptado e nada é guardado**
 * — `estaConfigurada()` devolve false e quem chama recusa a operação. Guardar
 * um segredo em claro porque a chave não estava definida seria pior do que
 * não guardar de todo.
 */

const VERSAO = 'v1'
const TAMANHO_IV = 12 // recomendado para GCM
const TAMANHO_TAG = 16

function lerChave(): Buffer | null {
  const bruta = process.env.APP_ENCRYPTION_KEY
  if (!bruta) return null

  const chave = Buffer.from(bruta, 'base64')
  if (chave.length !== 32) {
    console.error(
      `[crypto] APP_ENCRYPTION_KEY tem ${chave.length} bytes depois de descodificada; ` +
      'são precisos 32. Gera uma nova com: openssl rand -base64 32',
    )
    return null
  }
  return chave
}

/** True quando há uma chave de encriptação válida no ambiente. */
export function estaConfigurada(): boolean {
  return lerChave() !== null
}

/**
 * Encripta um segredo. Formato: `v1.<iv>.<tag>.<cifra>`, tudo em Base64url.
 * O prefixo de versão permite trocar de algoritmo mais tarde sem ambiguidade.
 */
export function encriptar(texto: string): string {
  const chave = lerChave()
  if (!chave) throw new Error('APP_ENCRYPTION_KEY não está definida — não é possível encriptar.')

  const iv = randomBytes(TAMANHO_IV)
  const cifra = createCipheriv('aes-256-gcm', chave, iv)
  const cifrado = Buffer.concat([cifra.update(texto, 'utf-8'), cifra.final()])
  const tag = cifra.getAuthTag()

  return [
    VERSAO,
    iv.toString('base64url'),
    tag.toString('base64url'),
    cifrado.toString('base64url'),
  ].join('.')
}

/**
 * Decifra um valor produzido por `encriptar`. Lança se a chave estiver
 * errada, se o formato não for reconhecido ou se o valor tiver sido
 * adulterado — nunca devolve lixo.
 */
export function decifrar(valor: string): string {
  const chave = lerChave()
  if (!chave) throw new Error('APP_ENCRYPTION_KEY não está definida — não é possível decifrar.')

  const partes = valor.split('.')
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new Error('Valor encriptado em formato desconhecido.')
  }

  const iv = Buffer.from(partes[1], 'base64url')
  const tag = Buffer.from(partes[2], 'base64url')
  const cifrado = Buffer.from(partes[3], 'base64url')

  if (iv.length !== TAMANHO_IV || tag.length !== TAMANHO_TAG) {
    throw new Error('Valor encriptado com dimensões inválidas.')
  }

  const decifra = createDecipheriv('aes-256-gcm', chave, iv)
  decifra.setAuthTag(tag)
  return Buffer.concat([decifra.update(cifrado), decifra.final()]).toString('utf-8')
}

/** True se o valor tem a forma de algo produzido por `encriptar`. */
export function pareceEncriptado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(`${VERSAO}.`) && valor.split('.').length === 4
}

/**
 * Mostra só os últimos caracteres de um segredo, para se poder confirmar
 * numa interface qual é a credencial guardada sem a revelar.
 */
export function mascarar(texto: string, visiveis = 4): string {
  if (texto.length <= visiveis) return '•'.repeat(texto.length)
  return '•'.repeat(Math.min(texto.length - visiveis, 8)) + texto.slice(-visiveis)
}
