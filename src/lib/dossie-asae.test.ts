import { describe, it, expect } from 'vitest'
import {
  montarDossie, reservasDoPeriodo, resumirComunicacao, limitacoes,
  type ReservaDossie, type SubmissaoDossie, type EstabelecimentoDossie,
} from './dossie-asae'
import { avaliarConformidade } from './compliance'

const HOJE = '2026-09-02'
const DE = '2025-09-02'
const ATE = '2026-09-02'

/** Um estabelecimento com tudo em dia — o caso a partir do qual se estraga. */
const COMPLETO: EstabelecimentoDossie & Record<string, unknown> = {
  nome: 'Casa de Vasco',
  endereco: 'Rua Direita 10',
  cidade: 'Aveiro',
  rnal_numero: '12345/AL',
  siba_nipc: '500000000',
  siba_estabelecimento: '00',
  seguro_seguradora: 'Fidelidade',
  seguro_apolice: 'AP-1',
  seguro_validade: '2027-01-01',
  livro_reclamacoes_registado: true,
  certificado_energetico_validade: '2030-01-01',
}

function reserva(over: Partial<ReservaDossie> = {}): ReservaDossie {
  return {
    id: 'b-1',
    check_in: '2026-06-01',
    check_out: '2026-06-04',
    num_hospedes: 2,
    estado: 'checkout',
    siba_status: 'submetido',
    siba_submitted_at: '2026-06-01T10:00:00Z',
    siba_metodo: 'webservice',
    ...over,
  }
}

function submissao(over: Partial<SubmissaoDossie> = {}): SubmissaoDossie {
  return {
    numero_ficheiro: 1,
    hash_envio: 'a'.repeat(64),
    sucesso: true,
    codigo_retorno: '0',
    booking_ids: ['b-1'],
    tentativas: 1,
    criado_em: '2026-06-01T10:00:00Z',
    ...over,
  }
}

describe('reservasDoPeriodo', () => {
  it('o critério é a entrada, não a sobreposição', () => {
    /* A obrigação de comunicar nasce da entrada do hóspede. Uma estadia de 28
     * de dezembro a 3 de janeiro pertence a dezembro, uma vez só — contá-la
     * nos dois anos faria os totais não fecharem com nada. */
    const r = reservasDoPeriodo([
      reserva({ id: 'dentro', check_in: '2025-12-28', check_out: '2026-01-03' }),
    ], '2026-01-01', '2026-12-31')

    expect(r).toHaveLength(0)
  })

  it('deixa de fora o que não chegou a ocupar', () => {
    const r = reservasDoPeriodo([
      reserva({ id: 'viva' }),
      reserva({ id: 'cancelada', estado: 'cancelada' }),
      reserva({ id: 'faltou', estado: 'no_show' }),
    ], DE, ATE)

    expect(r.map(x => x.id)).toEqual(['viva'])
  })

  it('ordena pela entrada, com desempate estável', () => {
    const r = reservasDoPeriodo([
      reserva({ id: 'b', check_in: '2026-07-01' }),
      reserva({ id: 'a', check_in: '2026-07-01' }),
      reserva({ id: 'c', check_in: '2026-01-01' }),
    ], DE, ATE)

    expect(r.map(x => x.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('resumirComunicacao', () => {
  it('separa comunicadas, por comunicar e falhadas', () => {
    const r = resumirComunicacao([
      reserva({ id: '1' }),
      reserva({ id: '2', siba_status: 'nao_submetido', siba_submitted_at: null }),
      reserva({ id: '3', siba_status: 'falhou', siba_error: 'recusado' }),
    ], HOJE)

    expect(r).toMatchObject({ reservas: 3, comunicadas: 1, porComunicar: 1, falhadas: 1 })
  })

  it('conta o atraso: por comunicar com a entrada já passada', () => {
    /* «Por comunicar» de uma estadia que ainda não começou é uma tarefa;
     * de uma que já começou é uma coima possível. O dossiê tem de as
     * distinguir, porque quem o lê distingue. */
    const r = resumirComunicacao([
      reserva({ id: 'passada', check_in: '2026-06-01', siba_status: 'nao_submetido' }),
      reserva({ id: 'futura', check_in: '2026-12-01', siba_status: 'nao_submetido' }),
    ], HOJE)

    expect(r.porComunicar).toBe(2)
    expect(r.emAtraso).toBe(1)
  })
})

describe('limitacoes', () => {
  const conformidadeOk = avaliarConformidade(COMPLETO, HOJE)

  it('diz sempre que não é um documento oficial', () => {
    /* É a limitação que impede o dossiê de ser lido como uma certificação, e
     * por isso não depende de nada: vale mesmo com tudo em dia. */
    const notas = limitacoes({
      estabelecimento: COMPLETO,
      conformidade: conformidadeOk,
      comunicacao: { reservas: 1, comunicadas: 1, porComunicar: 0, falhadas: 0, emAtraso: 0 },
      temSubmissoes: true,
    })

    expect(notas[0]).toContain('Não é emitido, validado nem reconhecido')
  })

  it('nomeia as obrigações por cumprir em vez de as esconder', () => {
    const semSeguro = avaliarConformidade({ ...COMPLETO, seguro_apolice: null }, HOJE)
    const notas = limitacoes({
      estabelecimento: COMPLETO,
      conformidade: semSeguro,
      comunicacao: { reservas: 0, comunicadas: 0, porComunicar: 0, falhadas: 0, emAtraso: 0 },
      temSubmissoes: false,
    })

    expect(notas.join(' ')).toContain('Seguro de responsabilidade civil')
  })

  it('conta as estadias sem comunicação entregue', () => {
    const notas = limitacoes({
      estabelecimento: COMPLETO,
      conformidade: conformidadeOk,
      comunicacao: { reservas: 10, comunicadas: 7, porComunicar: 2, falhadas: 1, emAtraso: 2 },
      temSubmissoes: true,
    })

    expect(notas.join(' ')).toContain('3 de 10 estadias')
  })

  it('avisa quando a unidade nem sequer tem credenciais do SIBA', () => {
    const notas = limitacoes({
      estabelecimento: { ...COMPLETO, siba_nipc: null },
      conformidade: conformidadeOk,
      comunicacao: { reservas: 0, comunicadas: 0, porComunicar: 0, falhadas: 0, emAtraso: 0 },
      temSubmissoes: false,
    })

    expect(notas.join(' ')).toContain('não tem credenciais do SIBA')
  })

  it('não afirma quem estava obrigado a ser comunicado', () => {
    // A app comunica o que lhe mandam comunicar; não decide a quem se aplica a
    // obrigação. Dar isso por resolvido seria responder a uma pergunta
    // jurídica que ninguém aqui respondeu.
    const notas = limitacoes({
      estabelecimento: COMPLETO,
      conformidade: conformidadeOk,
      comunicacao: { reservas: 1, comunicadas: 1, porComunicar: 0, falhadas: 0, emAtraso: 0 },
      temSubmissoes: true,
    })

    expect(notas.join(' ')).toContain('não quem estava obrigado')
  })
})

describe('montarDossie', () => {
  it('junta conformidade, comunicação e prova de envio', () => {
    const d = montarDossie({
      estabelecimento: COMPLETO,
      reservas: [reserva()],
      submissoes: [submissao()],
      de: DE, ate: ATE, hoje: HOJE,
      emitidoEm: '2026-09-02T09:00:00Z',
    })

    expect(d.comunicacao).toMatchObject({ reservas: 1, comunicadas: 1 })
    expect(d.resumoConformidade.criticos).toBe(0)
    expect(d.submissoes).toHaveLength(1)
    expect(d.submissoes[0].hash_envio).toHaveLength(64)
    expect(d.linhas[0]).toMatchObject({ bookingId: 'b-1', estado: 'Comunicado' })
  })

  it('as submissões vêm da mais recente para a mais antiga', () => {
    // Quem consulta isto procura a última, não a primeira.
    const d = montarDossie({
      estabelecimento: COMPLETO,
      reservas: [],
      submissoes: [
        submissao({ numero_ficheiro: 1, criado_em: '2026-01-01T10:00:00Z' }),
        submissao({ numero_ficheiro: 3, criado_em: '2026-08-01T10:00:00Z' }),
        submissao({ numero_ficheiro: 2, criado_em: '2026-04-01T10:00:00Z' }),
      ],
      de: DE, ate: ATE, hoje: HOJE,
      emitidoEm: '2026-09-02T09:00:00Z',
    })

    expect(d.submissoes.map(s => s.numero_ficheiro)).toEqual([3, 2, 1])
  })

  it('deixa de fora as submissões fora do período', () => {
    const d = montarDossie({
      estabelecimento: COMPLETO,
      reservas: [],
      submissoes: [
        submissao({ numero_ficheiro: 1, criado_em: '2024-01-01T10:00:00Z' }),
        submissao({ numero_ficheiro: 2, criado_em: '2026-04-01T10:00:00Z' }),
      ],
      de: DE, ate: ATE, hoje: HOJE,
      emitidoEm: '2026-09-02T09:00:00Z',
    })

    expect(d.submissoes.map(s => s.numero_ficheiro)).toEqual([2])
  })

  it('um envio falhado consta na mesma — é o que distingue tentar de não tentar', () => {
    const d = montarDossie({
      estabelecimento: COMPLETO,
      reservas: [],
      submissoes: [submissao({ sucesso: false, codigo_retorno: '99', mensagem: 'Recusado' })],
      de: DE, ate: ATE, hoje: HOJE,
      emitidoEm: '2026-09-02T09:00:00Z',
    })

    expect(d.submissoes).toHaveLength(1)
    expect(d.submissoes[0].sucesso).toBe(false)
  })

  it('um estabelecimento sem nada não gera um dossiê a dizer que está tudo bem', () => {
    /* A tentação é gerar um documento todo verde. Numa inspeção isso é pior do
     * que não ter dossiê: deixa de ser desorganização e passa a ser outra
     * coisa. */
    const d = montarDossie({
      estabelecimento: { nome: 'Casa Vazia' },
      reservas: [reserva({ siba_status: 'nao_submetido', siba_submitted_at: null })],
      submissoes: [],
      de: DE, ate: ATE, hoje: HOJE,
      emitidoEm: '2026-09-02T09:00:00Z',
    })

    expect(d.resumoConformidade.criticos).toBeGreaterThan(0)
    expect(d.comunicacao.emAtraso).toBe(1)
    expect(d.limitacoes.length).toBeGreaterThan(3)
  })
})
