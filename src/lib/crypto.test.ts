import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomBytes } from 'node:crypto'

vi.mock('server-only', () => ({}))

const { encriptar, decifrar, estaConfigurada, pareceEncriptado, mascarar } = await import('./crypto')

const CHAVE = randomBytes(32).toString('base64')

describe('crypto', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENCRYPTION_KEY', CHAVE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ida e volta devolve o mesmo texto', () => {
    expect(decifrar(encriptar('987654321'))).toBe('987654321')
  })

  it('preserva acentos e símbolos', () => {
    const original = 'chave-com-acentuação-e-€-símbolos'
    expect(decifrar(encriptar(original))).toBe(original)
  })

  it('nunca produz a mesma cifra duas vezes', () => {
    // IV aleatório: sem isto, duas contas com a mesma chave seriam
    // distinguíveis só por olhar para a base de dados.
    expect(encriptar('igual')).not.toBe(encriptar('igual'))
  })

  it('a cifra não contém o texto original', () => {
    expect(encriptar('SEGREDO')).not.toContain('SEGREDO')
  })

  it('recusa decifrar um valor adulterado', () => {
    const valor = encriptar('987654321')
    const partes = valor.split('.')
    const cifrado = Buffer.from(partes[3], 'base64url')
    cifrado[0] ^= 0xff
    partes[3] = cifrado.toString('base64url')
    expect(() => decifrar(partes.join('.'))).toThrow()
  })

  it('recusa decifrar com outra chave', () => {
    const valor = encriptar('987654321')
    vi.stubEnv('APP_ENCRYPTION_KEY', randomBytes(32).toString('base64'))
    expect(() => decifrar(valor)).toThrow()
  })

  it('recusa formatos desconhecidos', () => {
    expect(() => decifrar('texto-em-claro')).toThrow(/formato desconhecido/i)
    expect(() => decifrar('v2.a.b.c')).toThrow(/formato desconhecido/i)
  })

  it('sem chave no ambiente não encripta nem se diz configurado', () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', '')
    expect(estaConfigurada()).toBe(false)
    expect(() => encriptar('x')).toThrow(/APP_ENCRYPTION_KEY/)
  })

  it('rejeita uma chave com o tamanho errado', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('APP_ENCRYPTION_KEY', Buffer.from('curta').toString('base64'))
    expect(estaConfigurada()).toBe(false)
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
  })

  it('reconhece o que encriptou', () => {
    expect(pareceEncriptado(encriptar('x'))).toBe(true)
    expect(pareceEncriptado('987654321')).toBe(false)
    expect(pareceEncriptado(null)).toBe(false)
  })
})

describe('mascarar', () => {
  it('deixa ver só o fim', () => {
    expect(mascarar('987654321')).toBe('•••••4321')
  })

  it('não revela nada de um valor curto', () => {
    expect(mascarar('123')).toBe('•••')
  })

  it('não cresce indefinidamente com segredos longos', () => {
    expect(mascarar('a'.repeat(200))).toHaveLength(12)
  })
})
