import { describe, expect, it } from 'vitest'
import {
  agruparConversas, dentroDaJanelaWhatsApp, enderecoEmail, htmlParaTexto, limparRespostaEmail,
  linkWhatsApp, nomeDoRemetente, normalizarTelefone, type Mensagem,
} from './mensagens'

function msg(p: Partial<Mensagem>): Mensagem {
  return {
    id: Math.random().toString(36).slice(2),
    owner_id: 'u1',
    reserva_id: null,
    hospede_id: null,
    canal: 'email',
    direcao: 'entrada',
    estado: 'recebida',
    assunto: null,
    corpo: 'olá',
    contacto: null,
    nome_contacto: null,
    id_externo: null,
    sugerida_por_ia: false,
    lida_em: null,
    erro: null,
    criado_em: '2026-10-08T10:00:00.000Z',
    ...p,
  }
}

describe('normalizarTelefone', () => {
  it('aceita as formas habituais de escrever um número português', () => {
    expect(normalizarTelefone('912 345 678')).toBe('351912345678')
    expect(normalizarTelefone('+351 912 345 678')).toBe('351912345678')
    expect(normalizarTelefone('00351912345678')).toBe('351912345678')
    expect(normalizarTelefone('213 456 789')).toBe('351213456789')
  })

  it('mantém números estrangeiros com indicativo e recusa lixo', () => {
    expect(normalizarTelefone('+44 7700 900123')).toBe('447700900123')
    expect(normalizarTelefone('123')).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone(null)).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('leva o texto codificado e o número sem +', () => {
    expect(linkWhatsApp('912345678', 'Olá & bem-vinda')).toBe('https://wa.me/351912345678?text=Ol%C3%A1%20%26%20bem-vinda')
  })
  it('sem número válido não há link', () => {
    expect(linkWhatsApp('abc', 'x')).toBeNull()
  })
})

describe('dentroDaJanelaWhatsApp', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z')
  it('só conta mensagens do hóspede por WhatsApp nas últimas 24 h', () => {
    expect(dentroDaJanelaWhatsApp([msg({ canal: 'whatsapp', criado_em: '2026-10-08T01:00:00Z' })], agora)).toBe(true)
    expect(dentroDaJanelaWhatsApp([msg({ canal: 'whatsapp', criado_em: '2026-10-07T11:00:00Z' })], agora)).toBe(false)
    expect(dentroDaJanelaWhatsApp([msg({ canal: 'whatsapp', direcao: 'saida', criado_em: '2026-10-08T11:00:00Z' })], agora)).toBe(false)
    expect(dentroDaJanelaWhatsApp([msg({ canal: 'email', criado_em: '2026-10-08T11:00:00Z' })], agora)).toBe(false)
  })
})

describe('agruparConversas', () => {
  it('junta canais diferentes da mesma reserva numa só conversa', () => {
    const conversas = agruparConversas([
      msg({ reserva_id: 'r1', canal: 'email', criado_em: '2026-10-01T10:00:00Z', direcao: 'saida', estado: 'enviada', lida_em: null }),
      msg({ reserva_id: 'r1', canal: 'whatsapp', criado_em: '2026-10-02T10:00:00Z', contacto: '351912345678' }),
    ])
    expect(conversas).toHaveLength(1)
    expect(conversas[0].total).toBe(2)
    expect(conversas[0].canal).toBe('whatsapp')
    expect(conversas[0].porResponder).toBe(true)
    expect(conversas[0].porLer).toBe(1)
  })

  it('mensagens enviadas não contam como por ler e a resposta tira-a de «por responder»', () => {
    const [c] = agruparConversas([
      msg({ reserva_id: 'r1', criado_em: '2026-10-01T10:00:00Z', lida_em: '2026-10-01T11:00:00Z' }),
      msg({ reserva_id: 'r1', direcao: 'saida', estado: 'enviada', criado_em: '2026-10-01T12:00:00Z' }),
    ])
    expect(c.porLer).toBe(0)
    expect(c.porResponder).toBe(false)
  })

  it('sem reserva, a conversa é do contacto; as por ler sobem ao topo', () => {
    const conversas = agruparConversas([
      msg({ reserva_id: 'r1', criado_em: '2026-10-05T10:00:00Z', lida_em: '2026-10-05T10:01:00Z' }),
      msg({ canal: 'whatsapp', contacto: '447700900123', criado_em: '2026-10-01T10:00:00Z' }),
      msg({ canal: 'whatsapp', contacto: '447700900123', criado_em: '2026-10-01T10:05:00Z' }),
    ])
    expect(conversas.map(c => c.chave)).toEqual(['contacto:whatsapp:447700900123', 'reserva:r1'])
    expect(conversas[0].porLer).toBe(2)
  })
})

describe('limparRespostaEmail', () => {
  it('corta a citação do email anterior', () => {
    const texto = 'Chegamos às 18h, obrigado!\n\nEm qua., 8/10/2026 às 10:00, Casa do Mar escreveu:\n> Olá Maria\n> Até breve'
    expect(limparRespostaEmail(texto)).toBe('Chegamos às 18h, obrigado!')
  })
  it('corta a citação em inglês e a assinatura', () => {
    expect(limparRespostaEmail('See you\n-- \nJohn')).toBe('See you')
    expect(limparRespostaEmail('Thanks!\nOn Wed, Oct 8, 2026 at 10:00 AM Casa <x@y.pt> wrote:\n> hi')).toBe('Thanks!')
  })
  it('se tudo for citação, devolve o texto inteiro em vez de nada', () => {
    expect(limparRespostaEmail('> só citação')).toBe('> só citação')
  })
})

describe('emails', () => {
  it('extrai endereço e nome do From', () => {
    expect(enderecoEmail('Maria Silva <Maria@Exemplo.pt>')).toBe('maria@exemplo.pt')
    expect(enderecoEmail('maria@exemplo.pt')).toBe('maria@exemplo.pt')
    expect(enderecoEmail('não é email')).toBeNull()
    expect(nomeDoRemetente('"Maria Silva" <maria@exemplo.pt>')).toBe('Maria Silva')
    expect(nomeDoRemetente('maria@exemplo.pt')).toBeNull()
  })
  it('converte HTML em texto legível', () => {
    expect(htmlParaTexto('<p>Olá&nbsp;Ana</p><p>Até <b>já</b></p><style>p{}</style>')).toBe('Olá Ana\nAté já')
  })
})
