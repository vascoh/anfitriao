import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const inseridos: Array<{ tabela: string; dados: unknown }> = []

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (t: string) => ({
      select: () => construtor(t),
      insert: async (dados: unknown) => {
        inseridos.push({ tabela: t, dados })
        // O log de automações é a garantia de não repetir: refletir na "base".
        for (const l of Array.isArray(dados) ? dados : [dados]) {
          (tabelas[t] ??= []).push(l as Record<string, unknown>)
        }
        return { error: null }
      },
    }),
  }),
}))

vi.mock('@/lib/cron-auth', () => ({ checkCronAuth: () => null }))

const emails: Array<Record<string, unknown>> = []
vi.mock('@/lib/email', () => ({
  emailService: {
    sendAutomationMessage: async (p: Record<string, unknown>) => { emails.push(p); return { ok: true } },
  },
}))

const { GET } = await import('./route')

const HOJE = today()
const AMANHA = addDays(HOJE, 1)
const pedido = () => new NextRequest('http://localhost/api/cron/automations')

const AUTOMACAO = {
  id: 'a1', owner_id: 'user_1', nome: 'Boas-vindas',
  trigger_tipo: 'checkin_amanha', action_tipo: 'email_hospede',
  assunto: 'Chegada amanhã, {nome}', mensagem: 'Olá {nome}, até amanhã em {propriedade}!',
  ativo: true,
}

function reserva(id: string, over: Record<string, unknown> = {}) {
  return {
    id, owner_id: 'user_1', hospede_id: 'g1', propriedade_id: 'p1',
    check_in: AMANHA, check_out: addDays(HOJE, 4),
    estado: 'confirmada', reserva_grupo_id: null, ...over,
  }
}

beforeEach(() => {
  emails.length = 0
  inseridos.length = 0
  tabelas.automations = [AUTOMACAO]
  tabelas.bookings = [reserva('b1')]
  tabelas.guests = [{ id: 'g1', nome: 'Maria Silva', email: 'maria@exemplo.pt' }]
  tabelas.properties = [{ id: 'p1', nome: 'Casa de Vasco' }]
  tabelas.automation_log = []
})

describe('GET /api/cron/automations', () => {
  it('envia a mensagem do gatilho, com as variáveis substituídas', async () => {
    const res = await GET(pedido())
    expect(res.status).toBe(200)
    expect(emails).toHaveLength(1)
    expect(emails[0].subject).toBe('Chegada amanhã, Maria Silva')
    expect(String(emails[0].mensagem)).toContain('Casa de Vasco')
  })

  it('ignora automações desativadas', async () => {
    tabelas.automations = [{ ...AUTOMACAO, ativo: false }]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('não envia a reservas de outro anfitrião', async () => {
    tabelas.bookings = [reserva('b1', { owner_id: 'user_2' })]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('não envia a reservas fora da data do gatilho', async () => {
    tabelas.bookings = [reserva('b1', { check_in: addDays(HOJE, 5) })]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('uma casa inteira dá uma mensagem, não uma por quarto', async () => {
    /* O motor é anterior aos grupos: o hóspede recebia o mesmo "o teu
     * check-in é amanhã" três vezes na mesma manhã. */
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1' }),
      reserva('b2', { reserva_grupo_id: 'g1' }),
      reserva('b3', { reserva_grupo_id: 'g1' }),
    ]
    await GET(pedido())
    expect(emails).toHaveLength(1)
  })

  it('regista as reservas irmãs, senão amanhã repetia', async () => {
    tabelas.bookings = [
      reserva('b1', { reserva_grupo_id: 'g1' }),
      reserva('b2', { reserva_grupo_id: 'g1' }),
    ]
    await GET(pedido())

    const registados = tabelas.automation_log.map(l => l.booking_id).sort()
    expect(registados).toEqual(['b1', 'b2'])
  })

  it('não reenvia o que já está no log', async () => {
    tabelas.automation_log = [{ automation_id: 'a1', booking_id: 'b1', resultado: 'enviado' }]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('não envia a quem não tem email', async () => {
    tabelas.guests = [{ id: 'g1', nome: 'Maria', email: null }]
    await GET(pedido())
    expect(emails).toHaveLength(0)
  })

  it('sem automações ativas não faz nada', async () => {
    tabelas.automations = []
    const res = await GET(pedido())
    expect((await res.json()).enviados).toBe(0)
  })
})
