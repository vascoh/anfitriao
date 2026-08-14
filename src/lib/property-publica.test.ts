import { describe, it, expect } from 'vitest'
import { propriedadePublica, ocupacoesPublicas } from './property-publica'
import type { Booking, Property } from './types'

/** Uma propriedade como ela vem da base: `select('*')`, com tudo lá dentro. */
const COMPLETA = {
  id: 'p1',
  nome: 'Casa de Vasco',
  tipo: 'moradia',
  endereco: 'Rua de Bijagós 13A',
  cidade: 'Amora',
  capacidade: 8,
  quartos: 3,
  casasBanho: 2,
  comodidades: ['wifi'],
  descricao: 'Uma casa',
  imagem_url: 'https://exemplo/foto.jpg',
  fotos: [],
  preco_base: 100,
  taxa_limpeza: 30,
  cor: '#C2714F',
  ativo: true,
  parent_id: null,
  owner_id: 'user_1',
  mostrar_morada_publica: false,
  regras_casa: 'Não fumar',
  instrucoes_checkin: 'A chave está no cofre 1234',
  ical_feeds: [{ id: 'f1', url: 'https://airbnb.com/calendar/secreto.ics', source: 'airbnb', nome: 'Airbnb' }],
  rnal_numero: '12345/AL',
  seguro_seguradora: 'Fidelidade',
  seguro_apolice: 'AP-99',
  siba_nipc: '500000000',
  siba_estabelecimento: '1',
  siba_chave_acesso: 'v1.aaa.bbb.ccc',
  siba_telefone: '912345678',
  siba_email_contacto: 'vasco@exemplo.pt',
} as unknown as Property

describe('propriedadePublica', () => {
  const publica = propriedadePublica(COMPLETA)
  const serializada = JSON.stringify(publica)

  it('não leva as credenciais do SIBA', () => {
    // São as credenciais do anfitrião perante o Estado. Iam no HTML de uma
    // página que qualquer pessoa abre.
    for (const segredo of ['500000000', 'v1.aaa.bbb.ccc', '912345678', 'vasco@exemplo.pt']) {
      expect(serializada).not.toContain(segredo)
    }
    expect(serializada).not.toContain('siba')
  })

  it('não leva os endereços iCal privados', () => {
    // Quem os tenha lê o calendário de reservas todo, direto da plataforma.
    expect(serializada).not.toContain('secreto.ics')
    expect(serializada).not.toContain('ical_feeds')
  })

  it('não leva conformidade nem instruções de check-in', () => {
    expect(serializada).not.toContain('12345/AL')
    expect(serializada).not.toContain('AP-99')
    expect(serializada).not.toContain('cofre')
  })

  it('não leva o owner_id', () => {
    expect(serializada).not.toContain('user_1')
  })

  it('respeita a definição de mostrar a morada', () => {
    expect(publica.endereco).toBeUndefined()
    expect(serializada).not.toContain('Bijagós')

    const comMorada = propriedadePublica({ ...COMPLETA, mostrar_morada_publica: true } as Property)
    expect(comMorada.endereco).toBe('Rua de Bijagós 13A')
  })

  it('leva o que a página precisa mesmo', () => {
    expect(publica).toMatchObject({
      id: 'p1',
      nome: 'Casa de Vasco',
      cidade: 'Amora',
      capacidade: 8,
      preco_base: 100,
      taxa_limpeza: 30,
      regras_casa: 'Não fumar',
    })
  })

  it('um campo novo na tabela não passa a público sozinho', () => {
    // Lista de permitidos, não de proibidos.
    const comCampoNovo = propriedadePublica({
      ...COMPLETA,
      segredo_futuro: 'não devia sair daqui',
    } as unknown as Property)
    expect(JSON.stringify(comCampoNovo)).not.toContain('não devia sair daqui')
  })
})

describe('ocupacoesPublicas', () => {
  function reserva(over: Partial<Booking> = {}): Booking {
    return {
      id: 'b1', propriedade_id: 'p1', hospede_id: 'g1',
      check_in: '2026-09-10', check_out: '2026-09-14',
      num_hospedes: 2, estado: 'confirmada', origem: 'airbnb',
      preco_total: 480, preco_pago: 480,
      notas: 'Reserved - Maria Silva - HMABC123',
      criado_em: '2026-08-01', historico: [],
      ...over,
    } as Booking
  }

  it('leva as datas e nada mais', () => {
    const [o] = ocupacoesPublicas([reserva()])
    expect(o).toEqual({ propriedade_id: 'p1', check_in: '2026-09-10', check_out: '2026-09-14' })
  })

  it('não leva hóspede, preço nem notas', () => {
    // As notas do iCal trazem o nome de quem reservou e o código da reserva.
    const s = JSON.stringify(ocupacoesPublicas([reserva()]))
    expect(s).not.toContain('Maria Silva')
    expect(s).not.toContain('HMABC123')
    expect(s).not.toContain('480')
    expect(s).not.toContain('g1')
  })

  it('canceladas e no-shows não ocupam datas', () => {
    expect(ocupacoesPublicas([reserva({ estado: 'cancelada' })])).toHaveLength(0)
    expect(ocupacoesPublicas([reserva({ estado: 'no_show' })])).toHaveLength(0)
  })
})
