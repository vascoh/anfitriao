import { describe, it, expect } from 'vitest'
import { normalizarRnal, verificarRnal, rnalParaGravar, MAX_DIGITOS_RNAL } from './rnal'

describe('normalizarRnal', () => {
  it('deixa a forma canónica como está', () => {
    expect(normalizarRnal('12345/AL')).toBe('12345/AL')
  })

  it('aceita o que os anfitriões escrevem à mão', () => {
    // Todos estes são o mesmo registo, escrito de seis maneiras diferentes.
    for (const escrito of ['12345', '12345 AL', '12345/al', 'AL 12345', 'n.º 12345/AL', ' 12345 / AL ']) {
      expect(normalizarRnal(escrito)).toBe('12345/AL')
    }
  })

  it('tira zeros à esquerda, que são erro de transcrição', () => {
    expect(normalizarRnal('0012345/AL')).toBe('12345/AL')
  })

  it('tira pontos e espaços de milhar', () => {
    expect(normalizarRnal('12.345/AL')).toBe('12345/AL')
    expect(normalizarRnal('12 345/AL')).toBe('12345/AL')
  })

  it('devolve null em vez de adivinhar quando há texto a mais', () => {
    expect(normalizarRnal('Alojamento 12345')).toBeNull()
    expect(normalizarRnal('12345/AL (pedido)')).toBeNull()
    expect(normalizarRnal('registo em curso')).toBeNull()
  })

  it('não cose dois grupos de dígitos num número inventado', () => {
    // O pior resultado possível seria `123452024/AL` — bem formado e falso.
    expect(normalizarRnal('12345/AL/2024')).toBeNull()
    expect(normalizarRnal('12345 e 67890')).toBeNull()
  })

  it('devolve null para vazio e nulo', () => {
    expect(normalizarRnal('')).toBeNull()
    expect(normalizarRnal('   ')).toBeNull()
    expect(normalizarRnal(null)).toBeNull()
    expect(normalizarRnal(undefined)).toBeNull()
  })
})

describe('verificarRnal', () => {
  it('passa um número bem formado e devolve a forma canónica', () => {
    const r = verificarRnal('12345 al')
    expect(r.valido).toBe(true)
    expect(r.normalizado).toBe('12345/AL')
    expect(r.mensagem).toBe('')
  })

  it('distingue ausência de erro de forma', () => {
    // Não é a mesma coisa: uma pede o registo, a outra pede uma correção.
    expect(verificarRnal('').motivo).toBe('vazio')
    expect(verificarRnal('12345/AL/2024').motivo).toBe('caracteres_invalidos')
    expect(verificarRnal('sem número').motivo).toBe('sem_numero')
  })

  it('recusa o número zero', () => {
    expect(verificarRnal('0/AL').motivo).toBe('numero_zero')
    expect(verificarRnal('000').motivo).toBe('numero_zero')
  })

  it('recusa um número comprido de mais para ser um registo', () => {
    // Um NIF ou um IBAN colado por engano no campo errado.
    const comprido = '1'.repeat(MAX_DIGITOS_RNAL + 1)
    expect(verificarRnal(comprido).motivo).toBe('demasiado_longo')
    expect(verificarRnal('1'.repeat(MAX_DIGITOS_RNAL)).valido).toBe(true)
  })

  it('dá sempre uma mensagem quando não passa', () => {
    for (const mau of ['', 'xpto', '0/AL', '1'.repeat(20), '12345 (?)']) {
      const r = verificarRnal(mau)
      expect(r.valido).toBe(false)
      expect(r.mensagem.length).toBeGreaterThan(0)
      expect(r.normalizado).toBeNull()
    }
  })
})

describe('rnalParaGravar', () => {
  it('grava a forma canónica quando passa', () => {
    expect(rnalParaGravar('12345 al')).toBe('12345/AL')
  })

  it('não tranca o anfitrião fora do formulário: grava o que ele escreveu', () => {
    // Um formato que não conhecemos não pode impedir a gravação do resto do
    // cofre. O erro fica visível no cofre, não engolido aqui.
    expect(rnalParaGravar('12345/AL/2024')).toBe('12345/AL/2024')
  })

  it('vazio é null, não string vazia', () => {
    expect(rnalParaGravar('   ')).toBeNull()
    expect(rnalParaGravar(null)).toBeNull()
  })
})
