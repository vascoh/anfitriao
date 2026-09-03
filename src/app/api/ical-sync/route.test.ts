import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

/**
 * A rota que traz o calendário para dentro.
 *
 * Não tinha teste nenhum — e é a que o anfitrião depende todos os dias, a que
 * decide cancelar reservas, e a que foi restruturada a 2026-09-03 para
 * reconciliar **antes** de inserir. Uma mudança de ordem sem rede.
 *
 * O duplo respeita os filtros: um que devolvesse tudo a todas as consultas
 * faria estes testes passar sem provarem nada — foi o que aconteceu noutro
 * ficheiro esta manhã.
 */
type Linha = Record<string, unknown>

let propriedades: Linha[] = []
let reservas: Linha[] = []
/** URL do feed → conteúdo, ou um erro para simular leitura falhada. */
let feeds: Record<string, string | Error> = {}

const inseridas: Linha[] = []
const atualizadas: Array<{ id: unknown; campos: Linha }> = []
const feedsGravados: Array<{ id: unknown; ical_feeds: unknown }> = []

function construtor(tabela: string) {
  const filtros: Array<(l: Linha) => boolean> = []
  const alvo = () => (tabela === 'properties' ? propriedades : reservas).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    not: (c: string, op: string, v: string) => {
      if (op === 'is' && v === 'null') filtros.push(l => l[c] !== null && l[c] !== undefined)
      else if (op === 'in') {
        const proibidos = v.replace(/[()"]/g, '').split(',').map(s => s.trim())
        filtros.push(l => !proibidos.includes(String(l[c])))
      }
      return obj
    },
    order: () => obj,
    single: async () => ({ data: alvo()[0] ?? null, error: alvo()[0] ? null : { message: 'not found' } }),
    range: async (de: number, ate: number) => ({ data: alvo().slice(de, ate + 1), error: null }),
    then: (r: (v: { data: Linha[]; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      insert: (linhas: Linha[]) => ({
        select: async () => {
          const arr = Array.isArray(linhas) ? linhas : [linhas]
          inseridas.push(...arr)
          reservas.push(...arr)
          return { data: arr.map(l => ({ id: l.id })), error: null }
        },
      }),
      update: (campos: Linha) => {
        const filtros: Array<[string, unknown]> = []
        const alvo = {
          eq: (c: string, v: unknown) => {
            filtros.push([c, v])
            if (tabela === 'properties') {
              feedsGravados.push({ id: v, ical_feeds: campos.ical_feeds })
              return Promise.resolve({ error: null })
            }
            // bookings: a rota encadeia .eq('id').eq('owner_id')
            if (filtros.length === 1) return alvo
            atualizadas.push({ id: filtros[0][1], campos })
            const linha = reservas.find(r => r.id === filtros[0][1])
            if (linha) Object.assign(linha, campos)
            return Promise.resolve({ error: null })
          },
        }
        return alvo
      },
    }),
  }),
}))

vi.mock('@/lib/ical-fetch', () => ({
  fetchIcalText: async (url: string) => {
    const r = feeds[url]
    if (r instanceof Error) throw r
    if (r === undefined) throw new Error('feed não configurado no teste')
    return r
  },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_1' }) }))
vi.mock('@/lib/rate-limit-persistente', () => ({
  verificarLimite: async () => ({ allowed: true, remaining: 9, resetAt: 0 }),
}))

const { POST } = await import('./route')

const HOJE = today()
const PROP = 'p-1'

function calendario(...eventos: Array<{ uid: string; de: string; ate: string; sumario?: string }>): string {
  return [
    'BEGIN:VCALENDAR',
    'PRODID:Amenitiz Availability iCalendar',
    ...eventos.flatMap(e => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTART;VALUE=DATE:${e.de.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${e.ate.replace(/-/g, '')}`,
      `SUMMARY:${e.sumario ?? 'Quarto indisponível'}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n')
}

function feed(over: Linha = {}) {
  return { id: 'f1', url: 'https://amenitiz.io/a.ics', nome: 'Amenitiz', source: 'outro', ...over }
}

function reservaImportada(over: Linha = {}): Linha {
  return {
    id: 'b-1',
    propriedade_id: PROP,
    owner_id: 'user_1',
    uid_externo: 'f1::uid-antigo',
    check_in: addDays(HOJE, 10),
    check_out: addDays(HOJE, 14),
    estado: 'confirmada',
    notas: 'Quarto indisponível',
    historico: [],
    ...over,
  }
}

function pedido() {
  return new NextRequest('http://localhost/api/ical-sync', {
    method: 'POST',
    body: JSON.stringify({ propertyId: PROP }),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  propriedades = [{ id: PROP, owner_id: 'user_1', ical_feeds: [feed()], ativo: true }]
  reservas = []
  feeds = {}
  inseridas.length = 0
  atualizadas.length = 0
  feedsGravados.length = 0
})

describe('POST /api/ical-sync', () => {
  it('importa um evento que ainda não cá está', async () => {
    feeds['https://amenitiz.io/a.ics'] = calendario({ uid: 'novo', de: addDays(HOJE, 5), ate: addDays(HOJE, 8) })

    const json = await (await POST(pedido())).json()

    expect(json.synced).toBe(1)
    expect(inseridas).toHaveLength(1)
    expect(inseridas[0]).toMatchObject({
      propriedade_id: PROP,
      uid_externo: 'f1::novo',
      notas: 'Quarto indisponível',
    })
  })

  it('não reimporta um UID que já cá está', async () => {
    reservas = [reservaImportada({ uid_externo: 'f1::conhecido' })]
    feeds['https://amenitiz.io/a.ics'] = calendario({
      uid: 'conhecido', de: addDays(HOJE, 10), ate: addDays(HOJE, 14),
    })

    await POST(pedido())

    expect(inseridas).toHaveLength(0)
    expect(atualizadas).toHaveLength(0)
  })

  it('aplica as datas quando mudam com o mesmo UID', async () => {
    reservas = [reservaImportada({ uid_externo: 'f1::mesmo' })]
    feeds['https://amenitiz.io/a.ics'] = calendario({
      uid: 'mesmo', de: addDays(HOJE, 11), ate: addDays(HOJE, 15),
    })

    await POST(pedido())

    expect(inseridas).toHaveLength(0)
    expect(atualizadas[0].campos).toMatchObject({
      check_in: addDays(HOJE, 11),
      check_out: addDays(HOJE, 15),
    })
  })

  it('um bloqueio que muda de UID é atualizado, não cancelado e recriado', async () => {
    /* O caso real do Amenitiz: os UIDs são UUIDv5 — um hash do conteúdo — e
     * mudam quando as datas mudam. Antes de 2026-09-03 isto dava uma linha
     * cancelada e uma nova, todos os dias. É a razão de a rota reconciliar
     * antes de inserir. */
    reservas = [reservaImportada({ uid_externo: 'f1::uid-de-ontem' })]
    feeds['https://amenitiz.io/a.ics'] = calendario({
      uid: 'uid-de-hoje', de: addDays(HOJE, 11), ate: addDays(HOJE, 14),
    })

    await POST(pedido())

    expect(inseridas, 'criou uma linha nova em vez de atualizar').toHaveLength(0)
    expect(atualizadas).toHaveLength(1)
    expect(atualizadas[0].campos).toMatchObject({
      check_in: addDays(HOJE, 11),
      uid_externo: 'f1::uid-de-hoje',
    })
    expect(reservas.find(r => r.id === 'b-1')?.estado).toBe('confirmada')
  })

  it('uma reserva que desapareceu do feed é cancelada', async () => {
    reservas = [
      reservaImportada({ id: 'b-some', uid_externo: 'f1::sumiu' }),
      reservaImportada({ id: 'b-fica', uid_externo: 'f1::fica', check_in: addDays(HOJE, 30), check_out: addDays(HOJE, 33) }),
    ]
    feeds['https://amenitiz.io/a.ics'] = calendario({
      uid: 'fica', de: addDays(HOJE, 30), ate: addDays(HOJE, 33),
    })

    await POST(pedido())

    const cancelada = atualizadas.find(a => a.campos.estado === 'cancelada')
    expect(cancelada?.id).toBe('b-some')
  })

  it('um feed que falha não cancela nada e não carimba a data', async () => {
    reservas = [reservaImportada({ uid_externo: 'f1::viva' })]
    feeds['https://amenitiz.io/a.ics'] = new Error('timeout')

    await POST(pedido())

    expect(atualizadas.filter(a => a.campos.estado === 'cancelada')).toHaveLength(0)
    const guardado = (feedsGravados.at(-1)?.ical_feeds as Linha[])[0]
    expect(guardado.error).toBe('timeout')
    expect(guardado.last_sync, 'carimbou last_sync numa falha').toBeUndefined()
  })

  it('um feed que vem vazio depois de ter tido eventos não cancela nada', async () => {
    propriedades = [{ id: PROP, owner_id: 'user_1', ical_feeds: [feed({ last_count: 3 })], ativo: true }]
    reservas = [reservaImportada({ uid_externo: 'f1::viva' })]
    feeds['https://amenitiz.io/a.ics'] = calendario()

    await POST(pedido())

    expect(atualizadas.filter(a => a.campos.estado === 'cancelada')).toHaveLength(0)
  })

  it('guarda o estado dos feeds depois de uma leitura com sucesso', async () => {
    feeds['https://amenitiz.io/a.ics'] = calendario({ uid: 'x', de: addDays(HOJE, 5), ate: addDays(HOJE, 7) })

    await POST(pedido())

    const guardado = (feedsGravados.at(-1)?.ical_feeds as Linha[])[0]
    expect(guardado.last_count).toBe(1)
    expect(guardado.last_sync).toBeTruthy()
    expect(guardado.error).toBeUndefined()
  })

  it('recusa sincronizar o alojamento de outro anfitrião', async () => {
    propriedades = [{ id: PROP, owner_id: 'user_2', ical_feeds: [feed()], ativo: true }]

    expect((await POST(pedido())).status).toBe(404)
  })
})
