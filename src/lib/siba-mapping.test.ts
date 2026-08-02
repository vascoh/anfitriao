import { describe, it, expect } from 'vitest'
import { boletimDaLinha, unidadeDaPropriedade, abreviaturaDe, type LinhaBoletim, type LinhaUnidade } from './siba-mapping'

const LINHA: LinhaBoletim = {
  booking_id: 'b1',
  check_in: '2026-08-10',
  check_out: '2026-08-14',
  nome: 'Maria Silva',
  data_nascimento: '1985-03-14',
  nacionalidade: 'Portugal',
  numero_documento: 'CC12345678',
  tipo_documento: 'Cartão de Cidadão',
  pais_emissao: 'Portugal',
  pais_residencia: 'Portugal',
  local_residencia: 'Lisboa',
}

const PROPRIEDADE: LinhaUnidade = {
  id: 'p1',
  nome: 'Casa do Vale',
  endereco: 'Rua das Flores 12',
  cidade: 'Porto',
  siba_nipc: '123456789',
  siba_estabelecimento: '00',
  siba_codigo_postal: '4050-175',
  siba_telefone: '912345678',
  siba_email_contacto: 'anfitriao@exemplo.pt',
}

describe('boletimDaLinha', () => {
  it('converte uma linha completa', () => {
    const r = boletimDaLinha(LINHA)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.boletim).toMatchObject({
      nome: 'Maria',
      apelido: 'Silva',
      nacionalidade: 'PRT',
      tipoDocumento: 'B',
      paisEmissorDocumento: 'PRT',
      paisResidenciaOrigem: 'PRT',
      dataEntrada: '2026-08-10',
      dataSaida: '2026-08-14',
    })
  })

  it('normaliza a data de nascimento que vem do OCR em DD/MM/YYYY', () => {
    const r = boletimDaLinha({ ...LINHA, data_nascimento: '14/03/1985' })
    expect(r.ok && r.boletim.dataNascimento).toBe('1985-03-14')
  })

  it('assume o país emissor igual à nacionalidade quando não foi recolhido', () => {
    const r = boletimDaLinha({ ...LINHA, pais_emissao: null, nacionalidade: 'Alemanha' })
    expect(r.ok && r.boletim.paisEmissorDocumento).toBe('DEU')
  })

  it('trata uma nacionalidade desconhecida como campo em falta, sem adivinhar', () => {
    const r = boletimDaLinha({ ...LINHA, nacionalidade: 'Nárnia', pais_emissao: null })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltam).toContain('nacionalidade')
  })

  it('acusa os campos em falta de um hóspede só com nome', () => {
    const r = boletimDaLinha({
      booking_id: 'b2', check_in: '2026-08-10', check_out: '2026-08-14', nome: 'John Doe',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltam).toEqual(expect.arrayContaining([
      'nacionalidade', 'data de nascimento', 'número do documento',
      'tipo de documento', 'país de residência',
    ]))
  })

  it('aceita sem local de residência', () => {
    expect(boletimDaLinha({ ...LINHA, local_residencia: null }).ok).toBe(true)
  })

  it('não deixa passar espaços em branco como documento', () => {
    const r = boletimDaLinha({ ...LINHA, numero_documento: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltam).toContain('número do documento')
  })
})

describe('unidadeDaPropriedade', () => {
  it('converte uma propriedade registada', () => {
    const r = unidadeDaPropriedade(PROPRIEDADE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.unidade).toMatchObject({
      nipc: '123456789',
      estabelecimento: '00',
      codigoPostal: '4050',
      zonaPostal: '175',
      abreviatura: 'CV',
    })
  })

  it('acusa o que falta para registar', () => {
    const r = unidadeDaPropriedade({ id: 'p2', nome: 'Sem nada' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltam).toEqual(expect.arrayContaining([
      'NIPC', 'número de estabelecimento', 'código postal', 'email de contacto',
    ]))
  })

  it('usa o contacto do anfitrião quando a propriedade não o tem', () => {
    const r = unidadeDaPropriedade(
      { ...PROPRIEDADE, siba_email_contacto: null, siba_nome_contacto: null },
      { nome: 'Vasco', email: 'vasco@exemplo.pt' },
    )
    expect(r.ok && r.unidade.emailContacto).toBe('vasco@exemplo.pt')
    expect(r.ok && r.unidade.nomeContacto).toBe('Vasco')
  })

  it('respeita a abreviatura escolhida à mão', () => {
    const r = unidadeDaPropriedade({ ...PROPRIEDADE, siba_abreviatura: 'XPT' })
    expect(r.ok && r.unidade.abreviatura).toBe('XPT')
  })
})

describe('abreviaturaDe', () => {
  it('usa as iniciais e ignora as preposições', () => {
    expect(abreviaturaDe('Casa do Vale')).toBe('CV')
    expect(abreviaturaDe('Apartamento da Baixa do Porto')).toBe('ABP')
  })

  it('nunca passa de 3 caracteres', () => {
    expect(abreviaturaDe('Um Nome Muito Comprido Assim')).toHaveLength(3)
  })

  it('cai para as primeiras letras quando não há iniciais úteis', () => {
    expect(abreviaturaDe('do')).toBe('DO')
  })
})
