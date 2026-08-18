import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

/** Chaves já reservadas, como a chave primária da tabela faria. */
const guardadas = new Set<string>()
let falhaDaBase: { code?: string; message: string } | null = null

vi.mock('./supabase', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async ({ chave }: { chave: string }) => {
        if (falhaDaBase) return { error: falhaDaBase }
        if (guardadas.has(chave)) return { error: { code: '23505', message: 'duplicate key' } }
        guardadas.add(chave)
        return { error: null }
      },
      delete: () => ({
        eq: async (_c: string, chave: string) => { guardadas.delete(chave); return { error: null } },
      }),
    }),
  }),
}))

const { reservarEnvio, libertarEnvio, chaveDeEnvio } = await import('./envio-unico')

beforeEach(() => { guardadas.clear(); falhaDaBase = null })

describe('reservarEnvio', () => {
  it('a primeira execução envia', async () => {
    expect(await reservarEnvio('trial:conta_1:3')).toBe(true)
  })

  it('a segunda não', async () => {
    /* Era isto que faltava: o cron não guardava rasto nenhum, e uma segunda
     * execução no mesmo dia repetia o email a toda a gente. */
    await reservarEnvio('trial:conta_1:3')
    expect(await reservarEnvio('trial:conta_1:3')).toBe(false)
  })

  it('avisos diferentes para a mesma conta não se estorvam', async () => {
    expect(await reservarEnvio(chaveDeEnvio('trial_aviso', 'conta_1', '3'))).toBe(true)
    expect(await reservarEnvio(chaveDeEnvio('trial_aviso', 'conta_1', '1'))).toBe(true)
  })

  it('contas diferentes recebem cada uma o seu', async () => {
    expect(await reservarEnvio(chaveDeEnvio('relatorio', 'conta_1', '2026-07'))).toBe(true)
    expect(await reservarEnvio(chaveDeEnvio('relatorio', 'conta_2', '2026-07'))).toBe(true)
  })

  it('se a base falhar por outro motivo, o aviso sai à mesma', async () => {
    /* Mais vale um email repetido do que um anfitrião a perder o prazo de um
     * seguro porque uma tabela auxiliar estava indisponível. A tabela serve o
     * aviso, não o contrário. */
    falhaDaBase = { code: '08006', message: 'connection failure' }
    expect(await reservarEnvio('conformidade:user_1:2026-08-18')).toBe(true)
  })
})

describe('libertarEnvio', () => {
  it('devolve a reserva quando o envio não chegou a acontecer', async () => {
    const chave = chaveDeEnvio('trial_aviso', 'conta_1', '3')
    await reservarEnvio(chave)
    await libertarEnvio(chave)

    // O Resend em baixo às 10:00 não pode custar o aviso de amanhã.
    expect(await reservarEnvio(chave)).toBe(true)
  })
})

describe('chaveDeEnvio', () => {
  it('junta as três partes de forma legível', () => {
    expect(chaveDeEnvio('relatorio', 'user_abc', '2026-07')).toBe('relatorio:user_abc:2026-07')
  })
})
