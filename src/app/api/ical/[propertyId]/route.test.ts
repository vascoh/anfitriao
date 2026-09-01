import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

/**
 * O calendário que as plataformas leem para saber o que não podem vender.
 *
 * Um erro aqui não dá erro nenhum a ninguém: dá uma noite anunciada como livre
 * e duas pessoas à porta. Por isso o duplo da base respeita os filtros e o
 * `range` — o corte às mil linhas do PostgREST é justamente o que se testa.
 */
type Linha = Record<string, unknown>

let propriedades: Linha[] = []
let reservas: Linha[] = []
let erroNasReservas: { message: string } | null = null

function construtorReservas() {
  const filtros: Array<(l: Linha) => boolean> = []

  const obj = {
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    not: (c: string, op: string, v: string) => {
      if (op === 'in') {
        const proibidos = v.replace(/[()"]/g, '').split(',').map(s => s.trim())
        filtros.push(l => !proibidos.includes(String(l[c])))
      }
      return obj
    },
    gte: (c: string, v: string) => { filtros.push(l => String(l[c]) >= v); return obj },
    order: () => obj,
    range: async (de: number, ate: number) => {
      if (erroNasReservas) return { data: null, error: erroNasReservas }
      const todas = reservas
        .filter(l => filtros.every(f => f(l)))
        .sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)) ||
          String(a.id).localeCompare(String(b.id)))
      return { data: todas.slice(de, ate + 1), error: null }
    },
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => {
        if (tabela === 'properties') {
          return {
            eq: (coluna: string, valor: unknown) => {
              const iguais = propriedades.filter(p => p[coluna] === valor)
              return {
                single: async () => ({ data: iguais[0] ?? null, error: null }),
                then: (resolve: (v: { data: Linha[]; error: null }) => unknown) =>
                  resolve({ data: iguais, error: null }),
              }
            },
          }
        }
        return construtorReservas()
      },
    }),
  }),
}))

const { GET } = await import('./route')

const HOJE = today()
const CASA = { id: 'casa', nome: 'Casa de Vasco', owner_id: 'user_1' }

function pedir(id = 'casa') {
  return GET(
    new NextRequest(`http://localhost/api/ical/${id}`),
    { params: Promise.resolve({ propertyId: id }) },
  )
}

/** Os UIDs que o feed publicou, para contar eventos sem depender do formato. */
function uids(ics: string): string[] {
  return ics.split('\r\n').filter(l => l.startsWith('UID:')).map(l => l.slice(4))
}

function reserva(over: Linha = {}): Linha {
  return {
    id: `b-${Math.random().toString(36).slice(2)}`,
    propriedade_id: 'casa',
    hospede_id: 'g-1',
    check_in: addDays(HOJE, 10),
    check_out: addDays(HOJE, 12),
    estado: 'confirmada',
    ...over,
  }
}

beforeEach(() => {
  propriedades = [{ ...CASA, parent_id: null }]
  reservas = []
  erroNasReservas = null
})

describe('GET /api/ical/[propertyId]', () => {
  it('publica as reservas futuras do alojamento', async () => {
    reservas = [reserva({ id: 'b-1' })]
    const ics = await (await pedir()).text()

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('X-WR-CALNAME:Casa de Vasco')
    expect(uids(ics)).toHaveLength(1)
  })

  it('nunca publica o id real da reserva', async () => {
    /* O id dá acesso a GET /api/checkin/[bookingId], que devolve dados do
     * hóspede — e este feed é público para quem souber o propertyId. */
    reservas = [reserva({ id: 'b-secreta' })]
    const ics = await (await pedir()).text()

    expect(ics).not.toContain('b-secreta')
    expect(ics).not.toContain('g-1')
  })

  it('não publica canceladas nem no-shows', async () => {
    reservas = [
      reserva({ id: 'b-viva' }),
      reserva({ id: 'b-cancelada', estado: 'cancelada' }),
      reserva({ id: 'b-no-show', estado: 'no_show' }),
    ]
    expect(uids(await (await pedir()).text())).toHaveLength(1)
  })

  it('não arrasta o passado', async () => {
    // Um gestor de canais só precisa do que ainda está por acontecer, e o
    // histórico é o que enchia a resposta até ao corte das mil linhas.
    reservas = [
      reserva({ id: 'b-antiga', check_in: addDays(HOJE, -30), check_out: addDays(HOJE, -25) }),
      reserva({ id: 'b-futura' }),
    ]
    expect(uids(await (await pedir()).text())).toHaveLength(1)
  })

  it('a estadia a decorrer continua a bloquear', async () => {
    reservas = [reserva({ check_in: addDays(HOJE, -2), check_out: addDays(HOJE, 3) })]
    expect(uids(await (await pedir()).text())).toHaveLength(1)
  })

  it('uma casa está ocupada quando qualquer quarto seu está', async () => {
    propriedades.push({ id: 'q-1', parent_id: 'casa', ativo: true, owner_id: 'user_1' })
    reservas = [reserva({ id: 'b-do-quarto', propriedade_id: 'q-1' })]

    expect(uids(await (await pedir()).text())).toHaveLength(1)
  })

  it('um quarto apontado por outro dono não injeta datas neste calendário', async () => {
    propriedades.push({ id: 'q-intruso', parent_id: 'casa', ativo: true, owner_id: 'user_2' })
    reservas = [reserva({ id: 'b-intrusa', propriedade_id: 'q-intruso' })]

    expect(uids(await (await pedir()).text())).toHaveLength(0)
  })

  it('publica as reservas todas, e não as primeiras mil', async () => {
    /* O PostgREST corta a resposta às mil linhas sem o dizer. Com o histórico
     * lá dentro e ordenação por data, as que ficavam de fora eram as futuras —
     * o Airbnb via livre o que está vendido. */
    reservas = Array.from({ length: 1500 }, (_, i) =>
      reserva({ id: `b-${String(i).padStart(4, '0')}`, check_in: addDays(HOJE, i + 1), check_out: addDays(HOJE, i + 2) }),
    )

    expect(uids(await (await pedir()).text())).toHaveLength(1500)
  })

  it('uma leitura falhada devolve erro, não um calendário meio vazio', async () => {
    /* Um erro faz a plataforma manter a última leitura boa; um feed incompleto
     * fá-la vender por cima. */
    reservas = [reserva()]
    erroNasReservas = { message: 'timeout' }

    const res = await pedir()
    expect(res.status).toBe(503)
  })

  it('404 quando a propriedade não existe', async () => {
    propriedades = []
    expect((await pedir('nao-existe')).status).toBe(404)
  })
})
