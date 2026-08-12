import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomBytes } from 'node:crypto'

vi.mock('server-only', () => ({}))

const { protegerCampos, revelarCampos, revelarLista, CAMPOS_SENSIVEIS } =
  await import('./campos-sensiveis')
const { pareceEncriptado } = await import('./crypto')

const CHAVE = randomBytes(32).toString('base64')

/** Ficha típica saída do formulário de check-in. */
function ficha(extra: Record<string, unknown> = {}) {
  return {
    nome: 'Maria Silva',
    nacionalidade: 'Portugal',
    numero_documento: '12345678 9 ZZ4',
    data_validade_doc: '2030-05-01',
    data_nascimento: '1985-03-12',
    tipo_documento: 'Cartão de Cidadão',
    ...extra,
  }
}

describe('campos-sensiveis', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENCRYPTION_KEY', CHAVE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('proteger', () => {
    it('encripta os campos de documento e mais nenhum', () => {
      const guardado = protegerCampos(ficha())

      for (const campo of CAMPOS_SENSIVEIS) {
        expect(pareceEncriptado(guardado[campo] as string)).toBe(true)
      }
      // O que a app filtra e ordena tem de continuar legível na base.
      expect(guardado.nome).toBe('Maria Silva')
      expect(guardado.nacionalidade).toBe('Portugal')
      expect(guardado.data_nascimento).toBe('1985-03-12')
      expect(guardado.tipo_documento).toBe('Cartão de Cidadão')
    })

    it('é idempotente — reescrever uma ficha não cifra duas vezes', () => {
      const uma = protegerCampos(ficha())
      const outra = protegerCampos(uma)

      expect(outra.numero_documento).toBe(uma.numero_documento)
      expect(revelarCampos(outra).numero_documento).toBe('12345678 9 ZZ4')
    })

    it('deixa em paz nulos e vazios', () => {
      const guardado = protegerCampos(ficha({ numero_documento: null, data_validade_doc: '' }))
      expect(guardado.numero_documento).toBeNull()
      expect(guardado.data_validade_doc).toBe('')
    })

    it('em produção sem chave recusa guardar, em vez de gravar em claro', () => {
      vi.stubEnv('APP_ENCRYPTION_KEY', '')
      vi.stubEnv('VERCEL_ENV', 'production')

      expect(() => protegerCampos(ficha())).toThrow(/APP_ENCRYPTION_KEY/)
    })

    it('em produção sem chave deixa passar quem não traz campos de documento', () => {
      // Uma reserva pelo site só tem nome, email e telefone: não pode falhar
      // por causa de uma chave que aquele caminho nem usa.
      vi.stubEnv('APP_ENCRYPTION_KEY', '')
      vi.stubEnv('VERCEL_ENV', 'production')

      const semDocumento = { nome: 'João', email: 'joao@exemplo.pt' }
      expect(protegerCampos(semDocumento)).toEqual(semDocumento)
    })

    it('em desenvolvimento sem chave guarda em claro com aviso', () => {
      const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubEnv('APP_ENCRYPTION_KEY', '')
      vi.stubEnv('VERCEL_ENV', 'development')

      const guardado = protegerCampos(ficha())

      expect(guardado.numero_documento).toBe('12345678 9 ZZ4')
      expect(aviso).toHaveBeenCalled()
    })
  })

  describe('revelar', () => {
    it('ida e volta devolve a ficha original', () => {
      const original = ficha()
      expect(revelarCampos(protegerCampos(original))).toEqual(original)
    })

    it('linhas anteriores à encriptação continuam a ler-se', () => {
      // Sem isto seria precisa uma migração e uma paragem para reescrever
      // tudo antes de ligar a funcionalidade.
      const emClaro = ficha()
      expect(revelarCampos(emClaro)).toEqual(emClaro)
    })

    it('um valor adulterado devolve null em vez de rebentar a página', () => {
      const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const guardado = protegerCampos(ficha())
      const partes = (guardado.numero_documento as string).split('.')
      partes[3] = Buffer.from('outra coisa').toString('base64url')

      const lida = revelarCampos({ ...guardado, numero_documento: partes.join('.') })

      expect(lida.numero_documento).toBeNull()
      expect(lida.nome).toBe('Maria Silva')
      expect(erro).toHaveBeenCalled()
    })

    it('null passa a null', () => {
      expect(revelarCampos(null)).toBeNull()
    })

    it('a lista aceita null, vazio e mistura de cifrado com claro', () => {
      expect(revelarLista(null)).toEqual([])
      expect(revelarLista([])).toEqual([])

      const lista = revelarLista([protegerCampos(ficha()), ficha({ nome: 'Antigo' })])
      expect(lista[0].numero_documento).toBe('12345678 9 ZZ4')
      expect(lista[1].numero_documento).toBe('12345678 9 ZZ4')
      expect(lista[1].nome).toBe('Antigo')
    })
  })

  it('a cifra não deixa o número em claro na linha guardada', () => {
    // O ponto todo do exercício: quem leia a base não encontra o número.
    const guardado = JSON.stringify(protegerCampos(ficha()))
    expect(guardado).not.toContain('12345678 9 ZZ4')
    expect(guardado).not.toContain('2030-05-01')
  })
})
