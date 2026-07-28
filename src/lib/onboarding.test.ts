import { describe, it, expect } from 'vitest'
import { passosOnboarding, progressoOnboarding, type EstadoConta } from './onboarding'

const vazio: EstadoConta = {
  temPropriedade: false,
  temIcal: false,
  temReserva: false,
  temConformidade: false,
  siteAtivo: false,
}

const completo: EstadoConta = {
  temPropriedade: true,
  temIcal: true,
  temReserva: true,
  temConformidade: true,
  siteAtivo: true,
}

describe('passosOnboarding', () => {
  it('devolve sempre os cinco passos', () => {
    expect(passosOnboarding(vazio)).toHaveLength(5)
    expect(passosOnboarding(completo)).toHaveLength(5)
  })

  it('marca só o site como opcional', () => {
    const opcionais = passosOnboarding(vazio).filter(p => p.opcional).map(p => p.chave)
    expect(opcionais).toEqual(['site'])
  })

  it('muda o CTA da propriedade consoante já exista', () => {
    const sem = passosOnboarding(vazio)[0]
    const com = passosOnboarding({ ...vazio, temPropriedade: true })[0]
    expect(sem.href).toBe('/propriedades/nova')
    expect(com.href).toBe('/propriedades')
  })

  it('não usa brasileirismos na copy', () => {
    // CLAUDE.md: conecta→liga, planilha→folha de cálculo, sync→sincronizar
    const texto = passosOnboarding(vazio)
      .map(p => `${p.titulo} ${p.descricao} ${p.cta}`)
      .join(' ')
      .toLowerCase()
    for (const proibido of ['conecta', 'planilha', 'sync ']) {
      expect(texto).not.toContain(proibido)
    }
  })
})

describe('progressoOnboarding', () => {
  it('está a zero numa conta vazia', () => {
    const p = progressoOnboarding(vazio)
    expect(p.feitos).toBe(0)
    expect(p.percentagem).toBe(0)
    expect(p.completo).toBe(false)
  })

  it('aponta o primeiro passo em falta', () => {
    expect(progressoOnboarding(vazio).proximo?.chave).toBe('propriedade')
    expect(progressoOnboarding({ ...vazio, temPropriedade: true }).proximo?.chave).toBe('ical')
  })

  it('conta só os obrigatórios na percentagem', () => {
    // 4 obrigatórios: só o site está feito → 0%
    const p = progressoOnboarding({ ...vazio, siteAtivo: true })
    expect(p.total).toBe(4)
    expect(p.percentagem).toBe(0)
  })

  it('fica completo sem o passo opcional', () => {
    const p = progressoOnboarding({ ...completo, siteAtivo: false })
    expect(p.completo).toBe(true)
    expect(p.percentagem).toBe(100)
    expect(p.proximo).toBeUndefined()
  })

  it('calcula percentagens intermédias', () => {
    const p = progressoOnboarding({ ...vazio, temPropriedade: true, temIcal: true })
    expect(p.feitos).toBe(2)
    expect(p.percentagem).toBe(50)
  })

  it('está completo numa conta com tudo feito', () => {
    const p = progressoOnboarding(completo)
    expect(p.completo).toBe(true)
    expect(p.percentagem).toBe(100)
  })
})
