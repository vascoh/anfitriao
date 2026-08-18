import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

/** Duplo com filtros (`eq`/`in`) e captura de escritas. */
const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; tipo: string; dados: unknown }> = []

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    single: async () => ({ data: alvo()[0] ?? null, error: alvo()[0] ? null : { message: 'not found' } }),
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      update: (dados: unknown) => {
        escritas.push({ tabela, tipo: 'update', dados })
        return construtor(tabela)
      },
      insert: async (dados: unknown) => { escritas.push({ tabela, tipo: 'insert', dados }); return { error: null } },
      upsert: async (dados: unknown) => { escritas.push({ tabela, tipo: 'upsert', dados }); return { error: null } },
    }),
  }),
}))

let limitado = false
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: !limitado, remaining: 9, resetAt: 0 }),
  getClientIp: () => '1.2.3.4',
}))

const notificar = vi.fn(async () => {})
vi.mock('@/lib/notify-checkin', () => ({ sendCheckinCompleteNotification: () => notificar() }))

const { GET, POST } = await import('./route')

const HOJE = today()
const params = (id: string) => Promise.resolve({ bookingId: id })

function pedidoGet() {
  return new NextRequest('http://localhost/api/checkin/b1')
}
function pedidoPost(corpo: unknown) {
  return new NextRequest('http://localhost/api/checkin/b1', {
    method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' },
  })
}

const FICHA = {
  nome: 'Maria Silva',
  nacionalidade: 'Portugal',
  numero_documento: '12345678 9 ZZ4',
  data_nascimento: '1985-03-12',
  tipo_documento: 'Cartão de Cidadão',
  pais_residencia: 'Portugal',
}

beforeEach(() => {
  limitado = false
  escritas.length = 0
  notificar.mockClear()
  tabelas.bookings = [{
    id: 'b1', owner_id: 'user_1', hospede_id: 'g1', propriedade_id: 'p1',
    check_in: addDays(HOJE, 2), check_out: addDays(HOJE, 5),
    num_hospedes: 2, estado: 'confirmada', historico: [], reserva_grupo_id: null,
  }]
  tabelas.properties = [{ id: 'p1', nome: 'Casa de Vasco', cidade: 'Amora', imagem_url: 'x', owner_id: 'user_1' }]
  tabelas.website_settings = [{ owner_id: 'user_1', host_nome: 'Vasco', logo_texto: 'Casa' }]
  tabelas.reserva_hospedes = [{ booking_id: 'b1', guest_id: 'g1', principal: true }]
  tabelas.guests = [{ id: 'g1', nome: 'Maria Silva', email: 'maria@exemplo.pt', numero_documento: '12345678 9 ZZ4' }]
})

describe('GET /api/checkin/[bookingId]', () => {
  it('devolve os dados enquanto a janela está aberta', async () => {
    const res = await GET(pedidoGet(), { params: params('b1') })
    const json = await res.json()
    expect(json.guest?.nome).toBe('Maria Silva')
    expect(json.host_nome).toBe('Vasco')
  })

  it('não leva o owner_id da propriedade para o browser do hóspede', async () => {
    const json = await (await GET(pedidoGet(), { params: params('b1') })).json()
    expect(JSON.stringify(json.property)).not.toContain('user_1')
  })

  it('depois de submetido deixa de devolver dados pessoais', async () => {
    /* O URL é o id da reserva e anda por email: enquanto respondesse com a
     * ficha completa, era uma janela permanente para o documento de quem lá
     * dormiu. */
    tabelas.bookings[0].historico = [{ tipo: 'checkin_online', descricao: 'x' }]
    const json = await (await GET(pedidoGet(), { params: params('b1') })).json()
    expect(json.ja_submetido).toBe(true)
    expect(json.guest).toBeNull()
    expect(json.acompanhantes).toEqual([])
    // Continua a responder o que a página precisa para se explicar.
    expect(json.property?.nome).toBe('Casa de Vasco')
  })

  it('depois da estadia acabar também fecha', async () => {
    tabelas.bookings[0].check_in = addDays(HOJE, -10)
    tabelas.bookings[0].check_out = addDays(HOJE, -3)
    const json = await (await GET(pedidoGet(), { params: params('b1') })).json()
    expect(json.guest).toBeNull()
  })

  it('no dia do check-out ainda está aberta', async () => {
    tabelas.bookings[0].check_out = HOJE
    const json = await (await GET(pedidoGet(), { params: params('b1') })).json()
    expect(json.guest?.nome).toBe('Maria Silva')
  })

  it('uma reserva cancelada responde 410', async () => {
    tabelas.bookings[0].estado = 'cancelada'
    const res = await GET(pedidoGet(), { params: params('b1') })
    expect(res.status).toBe(410)
  })

  it('num quarto de grupo onde quem reservou não dorme, diz que não é ele', async () => {
    /* Sem isto o formulário do segundo quarto pedia menos uma ficha do que as
     * pessoas que lá dormem, e a reserva dava-se por completa com alguém por
     * comunicar. */
    tabelas.bookings[0].reserva_grupo_id = 'g-1'
    tabelas.reserva_hospedes = []
    const json = await (await GET(pedidoGet(), { params: params('b1') })).json()
    expect(json.principal_neste_quarto).toBe(false)
  })
})

describe('POST /api/checkin/[bookingId]', () => {
  it('grava a ficha de quem reservou', async () => {
    const res = await POST(pedidoPost(FICHA), { params: params('b1') })
    expect(res.status).toBe(200)
    const update = escritas.find(e => e.tabela === 'guests' && e.tipo === 'update')
    expect((update?.dados as Record<string, unknown>).nome).toBe('Maria Silva')
    expect(notificar).toHaveBeenCalledOnce()
  })

  it('recusa escrever depois de a estadia acabar', async () => {
    /* Com um link antigo dava para reescrever a ficha meses depois, apagar
     * dados de um boletim já entregue e voltar a disparar o email. */
    tabelas.bookings[0].check_out = addDays(HOJE, -1)
    const res = await POST(pedidoPost(FICHA), { params: params('b1') })
    expect(res.status).toBe(410)
    expect(escritas.filter(e => e.tabela === 'guests')).toHaveLength(0)
    expect(notificar).not.toHaveBeenCalled()
  })

  it('recusa numa reserva cancelada', async () => {
    tabelas.bookings[0].estado = 'cancelada'
    const res = await POST(pedidoPost(FICHA), { params: params('b1') })
    expect(res.status).toBe(410)
  })

  it('exige nome', async () => {
    const res = await POST(pedidoPost({ ...FICHA, nome: '   ' }), { params: params('b1') })
    expect(res.status).toBe(400)
  })

  it('guarda cada acompanhante como ficha própria e liga-o à reserva', async () => {
    // O boletim é por pessoa: sem isto, uma reserva de 8 comunicava uma.
    await POST(pedidoPost({
      ...FICHA,
      acompanhantes: [{ nome: 'João Silva', numero_documento: 'X1' }],
    }), { params: params('b1') })

    const inserts = escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')
    expect(inserts).toHaveLength(1)
    expect(escritas.some(e => e.tabela === 'reserva_hospedes')).toBe(true)
  })

  it('linhas de acompanhante em branco não criam fichas vazias', async () => {
    await POST(pedidoPost({ ...FICHA, acompanhantes: [{ nome: '' }, { nome: '  ' }] }), { params: params('b1') })
    expect(escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')).toHaveLength(0)
  })

  it('num grupo não volta a ligar quem reservou a este quarto', async () => {
    /* A rede de segurança do check-in voltava a ligar quem reservou em cada
     * quarto onde fizesse check-in: a mesma pessoa declarada N vezes ao SIBA
     * e os acompanhantes nunca. */
    tabelas.bookings[0].reserva_grupo_id = 'grupo-1'
    await POST(pedidoPost(FICHA), { params: params('b1') })

    const ligacoesDoPrincipal = escritas.filter(e =>
      e.tabela === 'reserva_hospedes' &&
      (e.dados as Record<string, unknown>).guest_id === 'g1',
    )
    expect(ligacoesDoPrincipal).toHaveLength(0)
  })

  it('numa reserva normal garante a ligação de quem reservou', async () => {
    await POST(pedidoPost(FICHA), { params: params('b1') })
    const ligacao = escritas.find(e =>
      e.tabela === 'reserva_hospedes' &&
      (e.dados as Record<string, unknown>).guest_id === 'g1',
    )
    expect(ligacao?.tipo).toBe('upsert')
  })

  it('deixa rasto no histórico da reserva', async () => {
    await POST(pedidoPost(FICHA), { params: params('b1') })
    const update = escritas.find(e => e.tabela === 'bookings' && e.tipo === 'update')
    const historico = (update?.dados as { historico: Array<{ tipo: string }> }).historico
    expect(historico.some(h => h.tipo === 'checkin_online')).toBe(true)
  })

  it('respeita o limitador de pedidos', async () => {
    limitado = true
    const res = await POST(pedidoPost(FICHA), { params: params('b1') })
    expect(res.status).toBe(429)
  })
})

/**
 * Quinta pergunta da série: **o que acontece à segunda vez?**
 *
 * O acompanhante só traz `id` quando o formulário foi reaberto. Na primeira
 * vez não traz nenhum — e dois toques seguidos no botão, ou uma resposta
 * perdida com o hóspede a insistir, criavam a mesma pessoa outra vez: duas
 * fichas, duas ligações e, no fim da cadeia, **dois boletins para o mesmo
 * hóspede** entregues ao SIBA.
 */
describe('POST duas vezes — acompanhantes', () => {
  const COM_ACOMPANHANTE = {
    ...FICHA,
    acompanhantes: [{ nome: 'João Silva', nacionalidade: 'Portugal', data_nascimento: '1990-01-01' }],
  }

  it('a segunda submissão atualiza a ficha em vez de criar outra', async () => {
    await POST(pedidoPost(COM_ACOMPANHANTE), { params: params('b1') })

    // O que a primeira submissão deixou na base, agora visível à segunda.
    tabelas.guests.push({ id: 'g2', nome: 'João Silva' })
    tabelas.reserva_hospedes.push({ booking_id: 'b1', guest_id: 'g2', principal: false })
    escritas.length = 0

    await POST(pedidoPost(COM_ACOMPANHANTE), { params: params('b1') })

    const criados = escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')
    expect(criados).toHaveLength(0)
    const atualizados = escritas.filter(e => e.tabela === 'guests' && e.tipo === 'update')
    expect(atualizados.length).toBeGreaterThan(0)
  })

  it('reconhece o nome escrito de outra maneira', async () => {
    tabelas.guests.push({ id: 'g2', nome: 'João Silva' })
    tabelas.reserva_hospedes.push({ booking_id: 'b1', guest_id: 'g2', principal: false })

    await POST(pedidoPost({
      ...FICHA,
      acompanhantes: [{ nome: '  joao   SILVA ', nacionalidade: 'Portugal' }],
    }), { params: params('b1') })

    expect(escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')).toHaveLength(0)
  })

  it('duas pessoas com o mesmo nome continuam a ser duas pessoas', async () => {
    /* Pai e filho na mesma reserva são dois boletins. Se a defesa contra
     * duplicados juntasse os dois, ficava uma pessoa por comunicar — que é o
     * erro caro, ao contrário do duplicado. */
    tabelas.guests.push({ id: 'g2', nome: 'João Silva' })
    tabelas.reserva_hospedes.push({ booking_id: 'b1', guest_id: 'g2', principal: false })

    await POST(pedidoPost({
      ...FICHA,
      acompanhantes: [{ nome: 'João Silva' }, { nome: 'João Silva' }],
    }), { params: params('b1') })

    // O primeiro reaproveita a ficha existente; o segundo é gente nova.
    expect(escritas.filter(e => e.tabela === 'guests' && e.tipo === 'update')).toHaveLength(2) // titular + acompanhante
    expect(escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')).toHaveLength(1)
  })

  it('quem reservou nunca é confundido com um acompanhante do mesmo nome', async () => {
    await POST(pedidoPost({
      ...FICHA,
      acompanhantes: [{ nome: 'Maria Silva' }],
    }), { params: params('b1') })

    const inseridos = escritas.filter(e => e.tabela === 'guests' && e.tipo === 'insert')
    expect(inseridos).toHaveLength(1)
  })
})
