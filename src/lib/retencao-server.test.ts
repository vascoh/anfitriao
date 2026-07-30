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
  hospede_id: string
  check_out: string
  estado: string
}

let guests: LinhaGuest[] = []
let bookings: LinhaBooking[] = []
const updates: Array<{ id: string; campos: Record<string, unknown> }> = []
const auditoria: Array<Record<string, unknown>> = []

/** Builder mínimo e thenable, como o do supabase-js. */
function thenable<T>(valor: T) {
  const obj = {
    eq: () => obj,
    in: () => obj,
    then: (resolve: (v: { data: T; error: null }) => unknown) =>
      resolve({ data: valor, error: null }),
  }
  return obj
}

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => (table === 'guests' ? thenable(guests) : thenable(bookings)),
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
  updates.length = 0
  auditoria.length = 0
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
