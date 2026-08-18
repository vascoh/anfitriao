import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

const tabelas: Record<string, Array<Record<string, unknown>>> = {}

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    lte: (c: string, v: string) => { filtros.push(l => String(l[c]) <= v); return obj },
    gt: (c: string, v: number) => { filtros.push(l => Number(l[c]) > v); return obj },
    not: () => obj,
    order: () => obj,
    limit: () => obj,
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({ from: (t: string) => ({ select: () => construtor(t) }) }),
}))

let segredoOk = true
vi.mock('@/lib/cron-auth', () => ({
  checkCronAuth: () => (segredoOk ? null : new Response('não autorizado', { status: 401 })),
}))

/** Reservas para as quais a emissão foi chamada. */
const emitidas: string[] = []
let resultado: { ok: boolean; motivo?: string } = { ok: true }
vi.mock('@/lib/faturacao/emitir', () => ({
  emitirFaturaDaReserva: async (_owner: string, bookingId: string) => {
    emitidas.push(bookingId)
    return resultado
  },
}))

const { GET } = await import('./route')

const HOJE = today()
const pedido = () => new NextRequest('http://localhost/api/cron/faturacao')

const CONTA = {
  owner_id: 'user_1', at_estado: 'configurada', serie_id: 's1',
  estado: 'ativa', emissao_automatica: true,
}

function reserva(id: string, over: Record<string, unknown> = {}) {
  return {
    id, owner_id: 'user_1', fatura_estado: 'nao_emitida',
    check_out: addDays(HOJE, -1), preco_total: 300, estado: 'checkout',
    reserva_grupo_id: null, ...over,
  }
}

beforeEach(() => {
  segredoOk = true
  emitidas.length = 0
  resultado = { ok: true }
  tabelas.faturacao_contas = [CONTA]
  tabelas.bookings = [reserva('b1')]
})

describe('GET /api/cron/faturacao', () => {
  it('sem o segredo do cron não faz nada', async () => {
    segredoOk = false
    const res = await GET(pedido())
    expect(res.status).toBe(401)
    expect(emitidas).toHaveLength(0)
  })

  it('emite as reservas que já fizeram checkout', async () => {
    const res = await GET(pedido())
    expect(res.status).toBe(200)
    expect(emitidas).toEqual(['b1'])
  })

  it('não emite antes do checkout', async () => {
    tabelas.bookings = [reserva('b1', { check_out: addDays(HOJE, 3) })]
    await GET(pedido())
    expect(emitidas).toHaveLength(0)
  })

  it('não emite valor zero', async () => {
    tabelas.bookings = [reserva('b1', { preco_total: 0 })]
    await GET(pedido())
    expect(emitidas).toHaveLength(0)
  })

  it('não emite o que já está emitido', async () => {
    tabelas.bookings = [reserva('b1', { fatura_estado: 'emitida' })]
    await GET(pedido())
    expect(emitidas).toHaveLength(0)
  })

  it('uma casa inteira dá uma chamada, não três', async () => {
    /* Sem isto, a segunda e a terceira linha do grupo chamavam a emissão
     * outra vez e contavam como falhas ('ja_emitida') num relatório onde
     * nada tinha falhado. */
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1' }),
      reserva('b2', { reserva_grupo_id: 'g1' }),
      reserva('b3', { reserva_grupo_id: 'g1' }),
    ]
    const res = await GET(pedido())
    expect(emitidas).toHaveLength(1)
    expect((await res.json()).emitidas).toBe(1)
  })

  it('grupos diferentes contam separadamente', async () => {
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1' }),
      reserva('b2', { reserva_grupo_id: 'g2' }),
      reserva('b3'),
    ]
    await GET(pedido())
    expect(emitidas).toHaveLength(3)
  })

  it('só olha para contas com emissão automática, ativas e com AT ligada', async () => {
    tabelas.faturacao_contas = [
      { ...CONTA, emissao_automatica: false },
      { ...CONTA, owner_id: 'user_2', estado: 'suspensa' },
      { ...CONTA, owner_id: 'user_3', at_estado: 'por_configurar' },
    ]
    await GET(pedido())
    expect(emitidas).toHaveLength(0)
  })

  it('uma falha não trava as outras reservas', async () => {
    // Fica `fatura_estado=falhou` com o motivo e aparece no painel; o cron
    // continua para a seguinte.
    resultado = { ok: false, motivo: 'fornecedor' }
    tabelas.bookings = [reserva('b1'), reserva('b2')]

    const res = await GET(pedido())
    expect(emitidas).toEqual(['b1', 'b2'])
    expect((await res.json()).falhadas).toBe(2)
  })

  it('sem contas prontas responde sem tentar nada', async () => {
    tabelas.faturacao_contas = []
    const res = await GET(pedido())
    expect(res.status).toBe(200)
    expect(emitidas).toHaveLength(0)
  })
})
