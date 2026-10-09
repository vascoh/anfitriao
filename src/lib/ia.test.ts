import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('IA_ATIVA', () => {
  it('desligada por omissão — sem crédito na Anthropic cada botão falhava à frente do utilizador', async () => {
    vi.stubEnv('NEXT_PUBLIC_IA_ATIVA', '')
    expect((await import('./ia')).IA_ATIVA).toBe(false)
  })

  it('só liga com «true» explícito', async () => {
    vi.stubEnv('NEXT_PUBLIC_IA_ATIVA', 'true')
    expect((await import('./ia')).IA_ATIVA).toBe(true)
  })
})
