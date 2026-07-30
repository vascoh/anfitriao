import { describe, it, expect, vi, afterEach } from 'vitest'
import { diagnosticarEmail, SANDBOX_FROM_EMAIL } from './config'
import { NoopProvider, mascararEmail } from './providers/resend'

/**
 * Guarda do aviso de arranque (ver `diagnosticarEmail`). O que estes testes
 * protegem não é o texto das mensagens, é a existência do aviso: a falha que
 * lhes deu origem passou semanas despercebida por ser silenciosa.
 */
describe('diagnosticarEmail', () => {
  const PROD = { VERCEL_ENV: 'production', NODE_ENV: 'production' } as NodeJS.ProcessEnv

  it('produção sem RESEND_API_KEY é erro', () => {
    const [problema, ...resto] = diagnosticarEmail(PROD)
    expect(problema.nivel).toBe('erro')
    expect(problema.mensagem).toContain('RESEND_API_KEY')
    expect(resto).toHaveLength(0)
  })

  it('desenvolvimento sem RESEND_API_KEY é só aviso', () => {
    const [problema] = diagnosticarEmail({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)
    expect(problema.nivel).toBe('aviso')
  })

  it('preview não é tratado como produção', () => {
    // NODE_ENV é "production" em previews; só o VERCEL_ENV os distingue.
    const [problema] = diagnosticarEmail({ VERCEL_ENV: 'preview', NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    expect(problema.nivel).toBe('aviso')
  })

  it('produção com chave mas sem EMAIL_FROM avisa do domínio sandbox', () => {
    const [problema] = diagnosticarEmail({ ...PROD, RESEND_API_KEY: 're_x' })
    expect(problema.nivel).toBe('erro')
    expect(problema.mensagem).toContain(SANDBOX_FROM_EMAIL)
  })

  it('NOTIFY_FROM antigo continua a contar como remetente definido', () => {
    expect(diagnosticarEmail({
      ...PROD,
      RESEND_API_KEY: 're_x',
      NOTIFY_FROM: 'Anfitriões <noreply@anfitrioes.pt>',
    })).toEqual([])
  })

  it('produção bem configurada não tem problemas', () => {
    expect(diagnosticarEmail({
      ...PROD,
      RESEND_API_KEY: 're_x',
      EMAIL_FROM: 'noreply@anfitrioes.pt',
    })).toEqual([])
  })
})

describe('mascararEmail', () => {
  it('mantém o domínio e esconde o resto', () => {
    expect(mascararEmail('vasco@exemplo.pt')).toBe('v***@exemplo.pt')
  })

  it('não deixa passar entradas sem @', () => {
    expect(mascararEmail('sem-arroba')).toBe('***')
    expect(mascararEmail('@exemplo.pt')).toBe('***')
  })
})

describe('NoopProvider', () => {
  afterEach(() => vi.restoreAllMocks())

  it('regista o email descartado sem expor o destinatário', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await new NoopProvider().send({
      from: 'Anfitriões <noreply@anfitrioes.pt>',
      to: 'joao@exemplo.com',
      subject: 'Reserva confirmada',
      html: '<p>olá</p>',
    })

    expect(res).toEqual({ ok: false, error: 'no_api_key' })
    const linha = warn.mock.calls[0][0] as string
    expect(linha).toContain('Reserva confirmada')
    expect(linha).toContain('j***@exemplo.com')
    expect(linha).not.toContain('joao@exemplo.com')
  })
})
