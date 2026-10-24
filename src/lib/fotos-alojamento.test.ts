import { describe, it, expect } from 'vitest'
import { validarAlteracoesAlojamento, fotoNossaDoAnfitriao } from './fotos-alojamento'

const nossa = (n: string, user = 'user_1') => `https://abc.public.blob.vercel-storage.com/propriedades/${user}/${n}.jpg`

describe('alterações do construtor a um alojamento', () => {
  it('só aceita fotografias carregadas por esta conta', () => {
    expect(fotoNossaDoAnfitriao(nossa('a'), 'user_1')).toBe(true)
    expect(fotoNossaDoAnfitriao(nossa('a', 'user_2'), 'user_1')).toBe(false)
    expect(fotoNossaDoAnfitriao('https://exemplo.com/propriedades/user_1/a.jpg', 'user_1')).toBe(false)
    expect(fotoNossaDoAnfitriao('http://abc.public.blob.vercel-storage.com/propriedades/user_1/a.jpg', 'user_1')).toBe(false)
  })

  it('a primeira fotografia é a capa; as outras vão para a galeria', () => {
    const r = validarAlteracoesAlojamento({ fotos: [nossa('b'), nossa('a'), nossa('b')] }, [], 'user_1')
    expect(r).toEqual({ ok: true, alteracoes: { imagem_url: nossa('b'), fotos: [nossa('a')] } })
  })

  it('mantém fotografias antigas de outro sítio, mas não aceita novas', () => {
    const antiga = 'https://images.unsplash.com/foto'
    expect(validarAlteracoesAlojamento({ fotos: [antiga] }, [antiga], 'user_1').ok).toBe(true)
    expect(validarAlteracoesAlojamento({ fotos: [antiga] }, [], 'user_1').ok).toBe(false)
    expect(validarAlteracoesAlojamento({ fotos: [nossa('x', 'user_2')] }, [], 'user_1').ok).toBe(false)
  })

  it('sem fotografias a capa fica vazia', () => {
    expect(validarAlteracoesAlojamento({ fotos: [] }, [], 'user_1'))
      .toEqual({ ok: true, alteracoes: { imagem_url: null, fotos: [] } })
  })

  it('limita textos e listas', () => {
    expect(validarAlteracoesAlojamento({ descricao: 'x'.repeat(4001) }, [], 'u').ok).toBe(false)
    expect(validarAlteracoesAlojamento({ fotos: Array.from({ length: 41 }, (_, i) => nossa(String(i), 'u')) }, [], 'u').ok).toBe(false)
    expect(validarAlteracoesAlojamento({ comodidades: ['wifi', ' wifi ', 'roupa de cama'] }, [], 'u'))
      .toEqual({ ok: true, alteracoes: { comodidades: ['wifi', 'roupa de cama'] } })
  })

  it('recusa corpo vazio ou com tipos errados', () => {
    expect(validarAlteracoesAlojamento({}, [], 'u').ok).toBe(false)
    expect(validarAlteracoesAlojamento(null, [], 'u').ok).toBe(false)
    expect(validarAlteracoesAlojamento({ descricao: 3 }, [], 'u').ok).toBe(false)
    expect(validarAlteracoesAlojamento({ fotos: 'a' }, [], 'u').ok).toBe(false)
  })
})
