import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { today, addDays } from '@/lib/utils'

vi.mock('server-only', () => ({}))

const tabelas: Record<string, Array<Record<string, unknown>>> = {}
const escritas: Array<{ tabela: string; tipo: string; dados: unknown }> = []

function construtor(tabela: string) {
  const filtros: Array<(l: Record<string, unknown>) => boolean> = []
  const alvo = () => (tabelas[tabela] ?? []).filter(l => filtros.every(f => f(l)))

  const obj = {
    eq: (c: string, v: unknown) => { filtros.push(l => l[c] === v); return obj },
    in: (c: string, vs: unknown[]) => { filtros.push(l => vs.includes(l[c])); return obj },
    gte: (c: string, v: string) => { filtros.push(l => String(l[c]) >= v); return obj },
    lte: (c: string, v: string) => { filtros.push(l => String(l[c]) <= v); return obj },
    not: () => obj,
    order: () => obj,
    limit: () => obj,
    /* A leitura das reservas passou a ser paginada (`carregarTudo`): sem
     * `range`, o duplo não exercitava o caminho que a rota usa mesmo. */
    range: async (de: number, ate: number) => ({ data: alvo().slice(de, ate + 1), error: null }),
    maybeSingle: async () => ({ data: alvo()[0] ?? null, error: null }),
    single: async () => ({ data: alvo()[0] ?? null, error: null }),
    then: (r: (v: { data: unknown; error: null }) => unknown) => r({ data: alvo(), error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (tabela: string) => ({
      select: () => construtor(tabela),
      insert: async (dados: unknown) => { escritas.push({ tabela, tipo: 'insert', dados }); return { error: null } },
      update: (dados: unknown) => { escritas.push({ tabela, tipo: 'update', dados }); return construtor(tabela) },
    }),
  }),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_1' }) }))
vi.mock('@/lib/audit', () => ({ logAudit: async () => {}, logAcessoSensivel: async () => {} }))

/** O que foi entregue ao SIBA, por chamada. */
const submissoes: Array<{ boletins: unknown[]; numeroFicheiro: number }> = []
let respostaSiba = { sucesso: true, codigo: '0', hashEnvio: 'hash-abc', tentativas: 1, respostaBruta: '<ok/>' }

vi.mock('@/lib/siba-api', () => ({
  submeterBoletins: async (p: { boletins: unknown[]; numeroFicheiro: number }) => {
    submissoes.push({ boletins: p.boletins, numeroFicheiro: p.numeroFicheiro })
    return respostaSiba
  },
  explicarFalha: () => 'falhou',
}))

vi.mock('@/lib/crypto', () => ({
  decifrar: (v: string) => v.replace('cifrado:', ''),
  estaConfigurada: () => true,
  // Usado por `campos-sensiveis` na leitura das fichas: aqui nada está cifrado.
  pareceEncriptado: () => false,
  encriptar: (v: string) => v,
  mascarar: (v: string) => v,
}))

const { POST } = await import('./route')

const HOJE = today()
const ONTEM = addDays(HOJE, -1)

function pedido(corpo: unknown = { from: addDays(HOJE, -30), to: HOJE }) {
  return new NextRequest('http://localhost/api/siba-submit', {
    method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' },
  })
}

/** Propriedade com o SIBA registado — as credenciais são por estabelecimento. */
const PROPRIEDADE = {
  id: 'p1', nome: 'Casa de Vasco', owner_id: 'user_1',
  endereco: 'Rua de Bijagós 13A', cidade: 'Amora',
  siba_nipc: '500000000', siba_estabelecimento: '00',
  siba_chave_acesso: 'cifrado:123456', siba_abreviatura: 'CDV',
  siba_codigo_postal: '2845-000', siba_telefone: '912345678',
  siba_nome_contacto: 'Vasco', siba_email_contacto: 'v@exemplo.pt',
}

const HOSPEDE_COMPLETO = {
  id: 'g1', nome: 'Maria Silva', data_nascimento: '1985-03-12',
  nacionalidade: 'Portugal', numero_documento: '12345678',
  tipo_documento: 'Cartão de Cidadão', pais_emissao: 'Portugal',
  pais_residencia: 'Portugal', local_residencia: 'Amora',
}

beforeEach(() => {
  escritas.length = 0
  submissoes.length = 0
  respostaSiba = { sucesso: true, codigo: '0', hashEnvio: 'hash-abc', tentativas: 1, respostaBruta: '<ok/>' }
  tabelas.properties = [PROPRIEDADE]
  tabelas.bookings = [{
    id: 'b1', owner_id: 'user_1', propriedade_id: 'p1', hospede_id: 'g1',
    check_in: ONTEM, check_out: addDays(HOJE, 2), num_hospedes: 1,
    estado: 'confirmada', siba_status: 'nao_submetido',
  }]
  // `owner_id` é obrigatório nas ligações: a rota filtra por ele.
  tabelas.reserva_hospedes = [{ booking_id: 'b1', guest_id: 'g1', principal: true, owner_id: 'user_1' }]
  tabelas.guests = [HOSPEDE_COMPLETO]
  tabelas.siba_submissoes = []
})

describe('POST /api/siba-submit', () => {
  it('entrega um boletim por pessoa', async () => {
    tabelas.bookings[0].num_hospedes = 2
    tabelas.guests.push({ ...HOSPEDE_COMPLETO, id: 'g2', nome: 'João Silva', numero_documento: '87654321' })
    tabelas.reserva_hospedes.push({ booking_id: 'b1', guest_id: 'g2', principal: false, owner_id: 'user_1' })

    const res = await POST(pedido())
    expect(res.status).toBe(200)
    expect(submissoes[0].boletins).toHaveLength(2)
  })

  it('recusa entregar quando faltam fichas, e diz quantas', async () => {
    /* Entregar 1 de 2 e marcar a reserva como submetida esconderia
     * exatamente o que se quer evitar: 100 a 2.000 € de coima por pessoa. */
    tabelas.bookings[0].num_hospedes = 3
    const res = await POST(pedido())
    const json = await res.json()

    expect(submissoes).toHaveLength(0)
    expect(JSON.stringify(json)).toContain('2')
  })

  it('recusa quando um hóspede não tem país de residência', async () => {
    // Sem ele nenhum boletim pode ser entregue — e o SIBA responderia com um
    // código numérico que não ajuda ninguém.
    tabelas.guests[0] = { ...HOSPEDE_COMPLETO, pais_residencia: null }
    const res = await POST(pedido())
    const json = await res.json()

    expect(submissoes).toHaveLength(0)
    expect(JSON.stringify(json).toLowerCase()).toContain('residência')
  })

  it('não entrega sem o alojamento estar registado no SIBA', async () => {
    tabelas.properties[0] = { ...PROPRIEDADE, siba_nipc: null }
    const res = await POST(pedido())
    expect(submissoes).toHaveLength(0)
    expect(JSON.stringify(await res.json())).toContain('SIBA')
  })

  it('guarda a prova da submissão, com o hash do que foi enviado', async () => {
    /* Todos os concorrentes vendem a submissão; o que interessa numa
     * fiscalização é a prova. */
    await POST(pedido())
    const prova = escritas.find(e => e.tabela === 'siba_submissoes')
    const dados = prova?.dados as Record<string, unknown>

    expect(dados.hash_envio).toBe('hash-abc')
    expect(dados.sucesso).toBe(true)
    expect(dados.resposta_bruta).toBe('<ok/>')
    expect(dados.booking_ids).toEqual(['b1'])
  })

  it('guarda a prova também quando o SIBA recusa', async () => {
    respostaSiba = { sucesso: false, codigo: '99', hashEnvio: 'hash-x', tentativas: 3, respostaBruta: '<erro/>' }
    await POST(pedido())

    const prova = escritas.find(e => e.tabela === 'siba_submissoes')
    expect((prova?.dados as Record<string, unknown>).sucesso).toBe(false)

    const marca = escritas.find(e => e.tabela === 'bookings' && e.tipo === 'update')
    expect((marca?.dados as Record<string, unknown>).siba_status).toBe('falhou')
  })

  it('marca a reserva como submetida quando corre bem', async () => {
    await POST(pedido())
    const marca = escritas.find(e => e.tabela === 'bookings' && e.tipo === 'update')
    const dados = marca?.dados as Record<string, unknown>
    expect(dados.siba_status).toBe('submetido')
    expect(dados.siba_error).toBeNull()
  })

  it('numera os ficheiros a partir da última submissão da propriedade', async () => {
    tabelas.siba_submissoes = [{ property_id: 'p1', numero_ficheiro: 7 }]
    await POST(pedido())
    expect(submissoes[0].numeroFicheiro).toBe(8)
  })

  it('recusa datas inválidas', async () => {
    const res = await POST(pedido({ from: HOJE, to: addDays(HOJE, -5) }))
    expect(res.status).toBe(400)
    expect(submissoes).toHaveLength(0)
  })

  it('uma reserva sem hóspedes identificados não é dada por entregue', async () => {
    tabelas.reserva_hospedes = []
    tabelas.bookings[0].hospede_id = null
    const res = await POST(pedido())
    expect(submissoes).toHaveLength(0)
    expect(JSON.stringify(await res.json())).toContain('hóspedes')
  })
})
