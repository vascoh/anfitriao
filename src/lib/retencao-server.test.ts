import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addDays } from './utils'
import { PRAZOS, NOME_ANONIMO } from './retencao'

vi.mock('server-only', () => ({}))

interface LinhaGuest {
  id: string
  owner_id: string | null
  criado_em: string | null
  anonimizado_grupos: string[] | null
}
interface LinhaBooking {
  id?: string
  hospede_id: string | null
  check_out: string
  estado: string
}
interface LinhaLigacao {
  guest_id: string
  booking_id: string
}

let guests: LinhaGuest[] = []
let bookings: LinhaBooking[] = []
let ligacoes: LinhaLigacao[] = []
const updates: Array<{ id: string; campos: Record<string, unknown> }> = []
const auditoria: Array<Record<string, unknown>> = []

/** Falhas de leitura a injetar, por tabela. `null` = a leitura corre bem. */
let erroLeitura: Partial<Record<'bookings' | 'reserva_hospedes' | 'guests', string>> = {}

/**
 * Builder mínimo, thenable e **paginável** — como o do supabase-js.
 *
 * O `range` existe porque as leituras de reservas passaram a usar
 * `carregarTudo`: sem ele o duplo não exercitava o caminho real.
 */
function builder<T>(linhas: () => T[], tabela: 'bookings' | 'reserva_hospedes' | 'guests') {
  const falha = () => erroLeitura[tabela] ?? null
  const obj = {
    eq: () => obj,
    in: () => obj,
    order: () => obj,
    range: async (de: number, ate: number) => {
      const e = falha()
      if (e) return { data: null, error: { message: e } }
      return { data: linhas().slice(de, ate + 1), error: null }
    },
    then: (resolve: (v: { data: T[] | null; error: { message: string } | null }) => unknown) => {
      const e = falha()
      return resolve(e ? { data: null, error: { message: e } } : { data: linhas(), error: null })
    },
  }
  return obj
}

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'guests') return builder(() => guests, 'guests')
        if (table === 'reserva_hospedes') return builder(() => ligacoes, 'reserva_hospedes')
        return builder(() => bookings, 'bookings')
      },
      update: (campos: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, campos })
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock('./audit', () => ({
  logAudit: async (p: Record<string, unknown>) => {
    auditoria.push(p)
  },
}))

const { aplicarRetencao } = await import('./retencao-server')

const HOJE = new Date().toISOString().slice(0, 10)

function hospede(over: Partial<LinhaGuest> = {}): LinhaGuest {
  return { id: 'g1', owner_id: 'user_1', criado_em: null, anonimizado_grupos: null, ...over }
}

beforeEach(() => {
  guests = []
  bookings = []
  ligacoes = []
  updates.length = 0
  auditoria.length = 0
  erroLeitura = {}
})

describe('aplicarRetencao', () => {
  it('não toca em quem saiu há pouco', async () => {
    guests = [hospede()]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -10), estado: 'checkout' }]

    const res = await aplicarRetencao()

    expect(res).toEqual({ avaliados: 1, anonimizados: 0, erros: 0 })
    expect(updates).toHaveLength(0)
  })

  it('apaga o boletim passado 1 ano da saída, e só o boletim', async () => {
    guests = [hospede()]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.boletim.dias), estado: 'checkout' }]

    const res = await aplicarRetencao()

    expect(res.anonimizados).toBe(1)
    const { campos } = updates[0]
    expect(campos.numero_documento).toBeNull()
    expect(campos.data_nascimento).toBeNull()
    // O contacto ainda tem prazo por cumprir
    expect(campos).not.toHaveProperty('email')
    expect(campos.nome).toBeUndefined()
    expect(campos.anonimizado_grupos).toEqual(['boletim'])
    expect(campos.retencao_completa).toBe(false)
  })

  it('conta o prazo de um acompanhante pela estadia dele, não pela data da ficha', async () => {
    /* Um acompanhante nunca é `bookings.hospede_id` — está na reserva por
     * `reserva_hospedes`. Sem olhar para lá, a retenção caía para a data de
     * criação da ficha, e a política documentada ("conta-se da última saída")
     * deixava de valer para a maioria das pessoas de um grupo. */
    guests = [hospede({ id: 'g2', criado_em: addDays(HOJE, -30) })]
    bookings = [{
      id: 'b1', hospede_id: 'g1', // quem reservou é outra pessoa
      check_out: addDays(HOJE, -PRAZOS.boletim.dias), estado: 'checkout',
    }]
    ligacoes = [{ guest_id: 'g2', booking_id: 'b1' }]

    const res = await aplicarRetencao()

    expect(res.anonimizados).toBe(1)
    expect(updates[0].campos.numero_documento).toBeNull()
  })

  it('uma estadia futura do acompanhante adia tudo', async () => {
    // A ficha foi criada há muito, mas a pessoa ainda cá vem dormir.
    guests = [hospede({ id: 'g2', criado_em: addDays(HOJE, -PRAZOS.contacto.dias) })]
    bookings = [{ id: 'b1', hospede_id: 'g1', check_out: addDays(HOJE, 30), estado: 'confirmada' }]
    ligacoes = [{ guest_id: 'g2', booking_id: 'b1' }]

    const res = await aplicarRetencao()

    expect(res.anonimizados).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('ao fim de 3 anos apaga tudo e fecha a retenção', async () => {
    guests = [hospede({ anonimizado_grupos: ['boletim'] })]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.contacto.dias), estado: 'checkout' }]

    await aplicarRetencao()

    const { campos } = updates[0]
    expect(campos.nome).toBe(NOME_ANONIMO)
    expect(campos.email).toBeNull()
    expect(campos.notas).toBeNull()
    expect(campos.anonimizado_grupos).toEqual(['boletim', 'contacto'])
    expect(campos.retencao_completa).toBe(true)
  })

  it('não repete o que já estava anonimizado', async () => {
    guests = [hospede({ anonimizado_grupos: ['boletim'] })]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.boletim.dias), estado: 'checkout' }]

    const res = await aplicarRetencao()

    expect(res.anonimizados).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('uma reserva cancelada antiga não faz o prazo correr', async () => {
    // Sem estadia não há data de saída: cai para a criação do registo, recente.
    guests = [hospede({ criado_em: `${addDays(HOJE, -5)}T10:00:00Z` })]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.contacto.dias), estado: 'cancelada' }]

    await aplicarRetencao()

    expect(updates).toHaveLength(0)
  })

  it('a estadia mais recente manda: quem volta reinicia o prazo', async () => {
    guests = [hospede()]
    bookings = [
      { hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.contacto.dias), estado: 'checkout' },
      { hospede_id: 'g1', check_out: addDays(HOJE, -30), estado: 'checkout' },
    ]

    await aplicarRetencao()

    expect(updates).toHaveLength(0)
  })

  it('sem reservas conta-se da criação do registo', async () => {
    guests = [hospede({ criado_em: `${addDays(HOJE, -PRAZOS.boletim.dias)}T10:00:00Z` })]

    await aplicarRetencao()

    expect(updates[0].campos.anonimizado_grupos).toEqual(['boletim'])
  })

  it('cada anonimização fica registada na auditoria', async () => {
    guests = [hospede()]
    bookings = [{ hospede_id: 'g1', check_out: addDays(HOJE, -PRAZOS.boletim.dias), estado: 'checkout' }]

    await aplicarRetencao()

    expect(auditoria).toHaveLength(1)
    expect(auditoria[0]).toMatchObject({
      entidade: 'guest',
      entidadeId: 'g1',
      acao: 'dados_anonimizados',
      actorId: null,
      detalhes: { grupos: ['boletim'], motivo: 'retencao' },
    })
  })
})

describe('aplicarRetencao · leitura incompleta', () => {
  /**
   * O bug: `ultimasSaidas` registava o erro e seguia com dados vazios. Um
   * hóspede cuja reserva não veio na resposta parece não ter estadia nenhuma,
   * e o prazo passa a contar-se da **criação da ficha** — que pode ser anos
   * antes do check-out. Uma falha passageira da base às 03:00 apagava dados de
   * documento cedo de mais, sem volta e sem ninguém dar por isso.
   */
  const HA_MUITO = addDays(HOJE, -(PRAZOS.contacto.dias + 30))

  /** Ficha criada há muito, mas com uma estadia recente — não deve ser tocada. */
  function cenario() {
    guests = [hospede({ id: 'g1', criado_em: HA_MUITO })]
    bookings = [{ id: 'b1', hospede_id: 'g1', check_out: HOJE, estado: 'checkout' }]
  }

  it('sem falhas, a estadia recente protege a ficha antiga', () => {
    cenario()
    return aplicarRetencao().then(r => {
      expect(r.anonimizados).toBe(0)
      expect(updates).toHaveLength(0)
    })
  })

  it('se a leitura das reservas falhar, não anonimiza nada', async () => {
    cenario()
    erroLeitura = { bookings: 'timeout' }

    const r = await aplicarRetencao()

    expect(updates, 'anonimizou com dados incompletos').toHaveLength(0)
    expect(r.anonimizados).toBe(0)
    expect(r.erros).toBe(1)
  })

  it('se a leitura dos acompanhantes falhar, também não', async () => {
    // Um acompanhante só existe em `reserva_hospedes`: perder essa leitura é
    // perder a única prova de que ele esteve cá.
    cenario()
    erroLeitura = { reserva_hospedes: 'timeout' }

    const r = await aplicarRetencao()

    expect(updates).toHaveLength(0)
    expect(r.erros).toBe(1)
  })

  it('a falha não é silenciosa — conta como erro no resultado', async () => {
    cenario()
    erroLeitura = { bookings: 'timeout' }
    expect((await aplicarRetencao()).erros).toBeGreaterThan(0)
  })
})
