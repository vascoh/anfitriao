import { describe, it, expect } from 'vitest'
import {
  avaliarValidade,
  avaliarConformidade,
  resumirConformidade,
  ordenarPorGravidade,
  DIAS_AVISO_EXPIRACAO,
  type CamposConformidade,
} from './compliance'

const HOJE = '2026-07-27'

/** Alojamento com tudo em ordem — base para variar um campo de cada vez. */
const completo: CamposConformidade = {
  rnal_numero: '12345/AL',
  rnal_data: '2024-03-01',
  seguro_seguradora: 'Fidelidade',
  seguro_apolice: 'AP-998877',
  seguro_validade: '2027-01-15',
  livro_reclamacoes_registado: true,
  certificado_energetico_validade: '2030-06-01',
}

describe('avaliarValidade', () => {
  it('devolve em_falta quando não há data', () => {
    expect(avaliarValidade(null, HOJE).estado).toBe('em_falta')
    expect(avaliarValidade(undefined, HOJE).estado).toBe('em_falta')
    expect(avaliarValidade('', HOJE).estado).toBe('em_falta')
  })

  it('marca como expirado uma data passada', () => {
    const r = avaliarValidade('2026-07-26', HOJE)
    expect(r.estado).toBe('expirado')
    expect(r.diasParaExpirar).toBe(-1)
  })

  it('trata o próprio dia da validade como a_expirar, não expirado', () => {
    const r = avaliarValidade(HOJE, HOJE)
    expect(r.estado).toBe('a_expirar')
    expect(r.diasParaExpirar).toBe(0)
  })

  it('marca a_expirar exatamente no limite da janela de aviso', () => {
    const r = avaliarValidade('2026-08-26', HOJE) // 30 dias depois
    expect(r.diasParaExpirar).toBe(DIAS_AVISO_EXPIRACAO)
    expect(r.estado).toBe('a_expirar')
  })

  it('marca ok um dia depois do limite da janela', () => {
    const r = avaliarValidade('2026-08-27', HOJE) // 31 dias
    expect(r.estado).toBe('ok')
    expect(r.diasParaExpirar).toBe(31)
  })

  it('respeita uma janela de aviso personalizada', () => {
    expect(avaliarValidade('2026-08-26', HOJE, 60).estado).toBe('a_expirar')
    expect(avaliarValidade('2026-08-26', HOJE, 10).estado).toBe('ok')
  })

  it('atravessa fronteiras de mês e de ano sem falhar', () => {
    expect(avaliarValidade('2027-01-01', '2026-12-31').diasParaExpirar).toBe(1)
    expect(avaliarValidade('2026-03-01', '2026-02-28').diasParaExpirar).toBe(1)
  })
})

describe('avaliarConformidade', () => {
  it('dá tudo ok para um alojamento completo', () => {
    const itens = avaliarConformidade(completo, HOJE)
    expect(itens).toHaveLength(4)
    expect(itens.every(i => i.estado === 'ok')).toBe(true)
  })

  it('assinala RNAL em falta', () => {
    const itens = avaliarConformidade({ ...completo, rnal_numero: null }, HOJE)
    const rnal = itens.find(i => i.chave === 'rnal')!
    expect(rnal.estado).toBe('em_falta')
    expect(rnal.obrigatorio).toBe(true)
  })

  it('trata RNAL só com espaços como em falta', () => {
    const itens = avaliarConformidade({ ...completo, rnal_numero: '   ' }, HOJE)
    expect(itens.find(i => i.chave === 'rnal')!.estado).toBe('em_falta')
  })

  it('assinala seguro em falta quando não há apólice, ignorando a validade', () => {
    const itens = avaliarConformidade(
      { ...completo, seguro_apolice: null, seguro_validade: '2027-01-15' },
      HOJE,
    )
    const seguro = itens.find(i => i.chave === 'seguro')!
    expect(seguro.estado).toBe('em_falta')
  })

  it('assinala seguro expirado', () => {
    const itens = avaliarConformidade({ ...completo, seguro_validade: '2026-01-01' }, HOJE)
    const seguro = itens.find(i => i.chave === 'seguro')!
    expect(seguro.estado).toBe('expirado')
    expect(seguro.detalhe).toContain('Fidelidade')
    expect(seguro.detalhe).toContain('AP-998877')
  })

  it('assinala seguro a expirar dentro da janela', () => {
    const itens = avaliarConformidade({ ...completo, seguro_validade: '2026-08-10' }, HOJE)
    expect(itens.find(i => i.chave === 'seguro')!.estado).toBe('a_expirar')
  })

  it('assinala o livro de reclamações por registar', () => {
    const itens = avaliarConformidade({ ...completo, livro_reclamacoes_registado: false }, HOJE)
    const livro = itens.find(i => i.chave === 'livro_reclamacoes')!
    expect(livro.estado).toBe('em_falta')
    expect(livro.obrigatorio).toBe(true)
  })

  it('marca o certificado energético como facultativo', () => {
    const itens = avaliarConformidade({ ...completo, certificado_energetico_validade: null }, HOJE)
    const ce = itens.find(i => i.chave === 'certificado_energetico')!
    expect(ce.estado).toBe('em_falta')
    expect(ce.obrigatorio).toBe(false)
  })

  it('lida com um alojamento totalmente vazio sem rebentar', () => {
    const itens = avaliarConformidade({}, HOJE)
    expect(itens).toHaveLength(4)
    expect(itens.every(i => i.estado === 'em_falta')).toBe(true)
  })

  it('inclui sempre a base legal em cada item', () => {
    for (const item of avaliarConformidade({}, HOJE)) {
      expect(item.base.length).toBeGreaterThan(0)
    }
  })

  it('usa singular correto para um dia', () => {
    const itens = avaliarConformidade({ ...completo, seguro_validade: '2026-07-28' }, HOJE)
    expect(itens.find(i => i.chave === 'seguro')!.detalhe).toContain('expira em 1 dia.')
  })

  it('diz "expira hoje" quando é o próprio dia', () => {
    const itens = avaliarConformidade({ ...completo, seguro_validade: HOJE }, HOJE)
    expect(itens.find(i => i.chave === 'seguro')!.detalhe).toContain('expira hoje')
  })
})

describe('resumirConformidade', () => {
  it('conta zero pendentes num alojamento completo', () => {
    const r = resumirConformidade(avaliarConformidade(completo, HOJE))
    expect(r.criticos).toBe(0)
    expect(r.aExpirar).toBe(0)
    expect(r.pendentes).toBe(0)
    expect(r.ok).toBe(4)
  })

  it('não conta o certificado energético como pendente por ser facultativo', () => {
    const r = resumirConformidade(
      avaliarConformidade({ ...completo, certificado_energetico_validade: null }, HOJE),
    )
    expect(r.pendentes).toBe(0)
    expect(r.criticos).toBe(0)
  })

  it('separa críticos de a_expirar', () => {
    const r = resumirConformidade(
      avaliarConformidade(
        { ...completo, rnal_numero: null, seguro_validade: '2026-08-05' },
        HOJE,
      ),
    )
    expect(r.criticos).toBe(1)   // RNAL em falta
    expect(r.aExpirar).toBe(1)   // seguro a expirar
    expect(r.pendentes).toBe(2)
  })

  it('conta os três obrigatórios num alojamento vazio', () => {
    const r = resumirConformidade(avaliarConformidade({}, HOJE))
    expect(r.criticos).toBe(3)
    expect(r.pendentes).toBe(3)
  })
})

describe('ordenarPorGravidade', () => {
  it('põe expirado antes de em_falta, e ok no fim', () => {
    const itens = avaliarConformidade(
      {
        ...completo,
        seguro_validade: '2026-01-01',      // expirado
        livro_reclamacoes_registado: false, // em falta
        certificado_energetico_validade: '2026-08-05', // a expirar
      },
      HOJE,
    )
    const ordem = ordenarPorGravidade(itens).map(i => i.chave)
    expect(ordem).toEqual(['seguro', 'livro_reclamacoes', 'certificado_energetico', 'rnal'])
  })

  it('não muta o array recebido', () => {
    const itens = avaliarConformidade({ ...completo, seguro_validade: '2026-01-01' }, HOJE)
    const antes = itens.map(i => i.chave)
    ordenarPorGravidade(itens)
    expect(itens.map(i => i.chave)).toEqual(antes)
  })

  it('coloca obrigatórios antes de facultativos com o mesmo estado', () => {
    const itens = avaliarConformidade({}, HOJE)
    const ordenados = ordenarPorGravidade(itens)
    expect(ordenados[ordenados.length - 1].chave).toBe('certificado_energetico')
  })
})
