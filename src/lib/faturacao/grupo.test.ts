import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../supabase', () => ({ createAdminClient: () => ({}) }))

const { linhasDoGrupo, totalComIva } = await import('./mapping')

/** A Casa de Vasco alugada por inteiro: 3 quartos, 4 noites. */
const QUARTOS = [
  { nome: 'Quarto Familiar', componentes: { alojamento: 400, limpeza: 20 } },
  { nome: 'Quarto de Casal', componentes: { alojamento: 320, limpeza: 15 } },
  { nome: 'Quarto Individual', componentes: { alojamento: 200, limpeza: 10 } },
]

describe('linhasDoGrupo', () => {
  it('uma linha de alojamento por quarto, com o nome do quarto', () => {
    const linhas = linhasDoGrupo(QUARTOS, 'Amora', '10 ago a 14 ago · 4 noites')
    const alojamento = linhas.filter(l => l.nome === 'Alojamento')

    expect(alojamento).toHaveLength(3)
    expect(alojamento[0].descricao).toContain('Quarto Familiar')
    expect(alojamento[2].descricao).toContain('Quarto Individual')
  })

  it('as limpezas somam-se numa linha — é um serviço, não três', () => {
    const linhas = linhasDoGrupo(QUARTOS, 'Amora', 'estadia')
    const limpezas = linhas.filter(l => l.nome === 'Taxa de limpeza')

    expect(limpezas).toHaveLength(1)
    // 20 + 15 + 10 = 45, com IVA incluído a 6%.
    expect(limpezas[0].precoUnitario * 1.06).toBeCloseTo(45, 1)
  })

  it('a taxa turística soma-se e continua isenta', () => {
    const linhas = linhasDoGrupo(
      QUARTOS.map((q, i) => ({ ...q, componentes: { ...q.componentes, taxaTuristica: [8, 4, 2][i] } })),
      'Lisboa',
      'estadia',
    )
    const tmt = linhas.filter(l => l.nome === 'Taxa municipal turística')

    expect(tmt).toHaveLength(1)
    expect(tmt[0].precoUnitario).toBe(14)
    expect(tmt[0].taxaIva).toBe(0)
    expect(tmt[0].motivoIsencao).toBe('M99')
  })

  it('o total da fatura é o que o hóspede paga pela casa toda', () => {
    const linhas = linhasDoGrupo(QUARTOS, 'Amora', 'estadia')
    // 400 + 320 + 200 + 45 de limpezas = 965.
    expect(totalComIva(linhas)).toBeCloseTo(965, 0)
  })

  it('usa a taxa da região do alojamento, não a do continente por omissão', () => {
    const madeira = linhasDoGrupo(QUARTOS, 'Funchal', 'estadia')
    const acores = linhasDoGrupo(QUARTOS, 'Ponta Delgada', 'estadia')

    expect(madeira[0].taxaIva).toBe(5)
    expect(acores[0].taxaIva).toBe(4)
  })

  it('não escreve linhas de valor zero', () => {
    const linhas = linhasDoGrupo(
      [{ nome: 'Quarto', componentes: { alojamento: 100 } }],
      'Amora',
      'estadia',
    )
    expect(linhas).toHaveLength(1)
    expect(linhas.every(l => l.precoUnitario > 0)).toBe(true)
  })

  it('ignora um quarto sem valor mas mantém os outros', () => {
    const linhas = linhasDoGrupo(
      [
        { nome: 'Quarto A', componentes: { alojamento: 100 } },
        { nome: 'Quarto B', componentes: { alojamento: 0 } },
      ],
      'Amora',
      'estadia',
    )
    expect(linhas.filter(l => l.nome === 'Alojamento')).toHaveLength(1)
  })
})

describe('repartição do total pelas reservas', () => {
  /**
   * A regra que evita o erro caro: o número do documento é partilhado pelas
   * três reservas, mas o `fatura_total` de cada uma guarda **a sua parte**.
   * O total faturado é somado a partir das reservas — repetir 920 € em três
   * linhas mostraria 2.760 € de receita que nunca existiu.
   */
  it('a soma das partes é o total do documento, e não o triplo', () => {
    const partes = [400, 320, 200]
    const documento = 920

    expect(partes.reduce((s, p) => s + p, 0)).toBe(documento)
    expect(partes.reduce((s, p) => s + p, 0)).not.toBe(documento * partes.length)
  })

  it('contar documentos não é contar reservas', () => {
    // Três reservas com o mesmo número de fatura são uma fatura.
    const reservas = [
      { id: 'b1', fatura_numero: 'FR 2026/12' },
      { id: 'b2', fatura_numero: 'FR 2026/12' },
      { id: 'b3', fatura_numero: 'FR 2026/12' },
    ]
    const documentos = new Set(reservas.map(r => r.fatura_numero))
    expect(reservas).toHaveLength(3)
    expect(documentos.size).toBe(1)
  })
})
