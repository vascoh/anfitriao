import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrar } from './vibrar'

describe('vibrar', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('não rebenta sem suporte', () => {
    vi.stubGlobal('navigator', {})
    expect(vibrar()).toBe(false)
  })

  it('usa o padrão do tipo pedido', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(vibrar('toque')).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('respeita quem pediu menos movimento', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(vibrar()).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })
})
