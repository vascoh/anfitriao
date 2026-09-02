import { describe, it, expect } from 'vitest'
import {
  estadoDoFeed, estadoDoAlojamento, erroAmigavel, HORAS_ATE_DESATUALIZADO, ESTADO_CANAL,
  CANAIS_IMPORTAVEIS,
} from './canais'
import type { IcalFeed } from './types'

const AGORA = new Date('2026-08-23T12:00:00Z')

function feed(over: Partial<IcalFeed> = {}): IcalFeed {
  return { id: 'f1', url: 'https://airbnb.com/calendar/ical/1.ics', source: 'airbnb', nome: 'Airbnb', ...over }
}

/** Quantas horas antes de AGORA, em ISO. */
function haHoras(h: number): string {
  return new Date(AGORA.getTime() - h * 3_600_000).toISOString()
}

describe('estadoDoFeed', () => {
  it('sem last_sync está por sincronizar', () => {
    expect(estadoDoFeed(feed(), AGORA)).toBe('por_sincronizar')
  })

  it('com erro está em erro, mesmo que tenha sincronizado há pouco', () => {
    expect(estadoDoFeed(feed({ last_sync: haHoras(1), error: 'Upstream devolveu 404' }), AGORA)).toBe('erro')
  })

  it('sincronizado há pouco está ligado', () => {
    expect(estadoDoFeed(feed({ last_sync: haHoras(2) }), AGORA)).toBe('ligado')
  })

  it('mesmo à beira do limite ainda está ligado', () => {
    expect(estadoDoFeed(feed({ last_sync: haHoras(HORAS_ATE_DESATUALIZADO - 0.1) }), AGORA)).toBe('ligado')
  })

  /* O caso que motivou o estado: o cron corre uma vez por dia, portanto um
   * feed parado há mais de 36 h falhou uma passagem sem o dizer a ninguém. */
  it('passado mais de um dia e meio está desatualizado', () => {
    expect(estadoDoFeed(feed({ last_sync: haHoras(HORAS_ATE_DESATUALIZADO + 1) }), AGORA)).toBe('desatualizado')
  })

  it('uma data ilegível não passa por ligado', () => {
    expect(estadoDoFeed(feed({ last_sync: 'nao-e-uma-data' }), AGORA)).toBe('por_sincronizar')
  })
})

describe('estadoDoAlojamento', () => {
  it('sem feeds está por configurar', () => {
    expect(estadoDoAlojamento([], AGORA)).toBe('nao_configurado')
  })

  it('todos bem, está ligado', () => {
    expect(estadoDoAlojamento([
      feed({ id: 'a', last_sync: haHoras(1) }),
      feed({ id: 'b', last_sync: haHoras(3) }),
    ], AGORA)).toBe('ligado')
  })

  /* O verde que esconde o vermelho é pior do que não ter crachá nenhum. */
  it('um feed em erro contamina o alojamento inteiro', () => {
    expect(estadoDoAlojamento([
      feed({ id: 'a', last_sync: haHoras(1) }),
      feed({ id: 'b', last_sync: haHoras(1), error: 'boom' }),
    ], AGORA)).toBe('erro')
  })

  it('o erro pesa mais do que o desatualizado', () => {
    expect(estadoDoAlojamento([
      feed({ id: 'a', last_sync: haHoras(100) }),
      feed({ id: 'b', error: 'boom' }),
    ], AGORA)).toBe('erro')
  })

  it('o desatualizado pesa mais do que o ligado', () => {
    expect(estadoDoAlojamento([
      feed({ id: 'a', last_sync: haHoras(1) }),
      feed({ id: 'b', last_sync: haHoras(100) }),
    ], AGORA)).toBe('desatualizado')
  })
})

describe('erroAmigavel', () => {
  it('404 explica que o endereço caducou e o que fazer', () => {
    const m = erroAmigavel('Upstream devolveu 404')
    expect(m).toMatch(/já não existe/)
    expect(m).toMatch(/copia o endereço atual/i)
  })

  it('403 fala em acesso recusado', () => {
    expect(erroAmigavel('Upstream devolveu 403')).toMatch(/recusou o acesso/)
  })

  it('timeout é apresentado como passageiro', () => {
    expect(erroAmigavel('The operation was aborted due to timeout')).toMatch(/demorou demasiado/)
  })

  it('429 diz para esperar', () => {
    expect(erroAmigavel('Upstream devolveu 429')).toMatch(/demasiado seguidas/)
  })

  /* As recusas da allowlist já foram escritas para humanos em ical-fetch.ts —
   * reescrevê-las perdia o nome do domínio, que é a parte acionável. */
  it('não mexe nas mensagens que já vêm escritas para humanos', () => {
    const original = 'O domínio "evil.example" não está na lista de plataformas suportadas. Se for o teu gestor de canais ou uma plataforma legítima, pede para ser acrescentado.'
    expect(erroAmigavel(original)).toBe(original)
  })

  it('o desconhecido é mostrado sem se perder o original', () => {
    expect(erroAmigavel('algo muito estranho')).toContain('algo muito estranho')
  })
})

describe('ESTADO_CANAL', () => {
  it('todos os estados têm rótulo, explicação e tom', () => {
    for (const [nome, d] of Object.entries(ESTADO_CANAL)) {
      expect(d.label, nome).toBeTruthy()
      expect(d.explicacao.length, nome).toBeGreaterThan(20)
      expect(['verde', 'ambar', 'vermelho', 'neutro'], nome).toContain(d.tom)
    }
  })
})

describe('CANAIS_IMPORTAVEIS', () => {
  it('o gestor de canais vem primeiro', () => {
    /* Não é ordem alfabética nem estética: quem tem um Amenitiz tem de o
     * escolher a ele e a mais nada, porque as reservas das OTA já vêm lá
     * dentro. Estando em último, a seguir a quatro plataformas, a opção certa
     * era a última a ser vista por quem mais precisava dela — e a lista
     * parecia dizer que a app só falava com Airbnb e Booking. */
    expect(CANAIS_IMPORTAVEIS[0]).toBe('outro')
  })

  it('não oferece «direto» — não há calendário nenhum a ir buscar ao próprio site', () => {
    expect(CANAIS_IMPORTAVEIS).not.toContain('direto')
  })
})
