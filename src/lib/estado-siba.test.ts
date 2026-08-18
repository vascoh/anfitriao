import { describe, it, expect } from 'vitest'
import { estadoSiba, estaEmAtraso } from './estado-siba'

describe('estadoSiba', () => {
  it('sem nada dito, está por comunicar', () => {
    expect(estadoSiba({}).chave).toBe('nao_submetido')
    expect(estadoSiba({}).porCumprir).toBe(true)
  })

  it('um estado que já não é escrito por código nenhum não parte a interface', () => {
    /* `a_processar` esteve no tipo desde o início e nunca foi escrito. Um
     * mapa de rótulos indexado pelo valor devolveria `undefined` e a etiqueta
     * apareceria vazia — o ecrã em branco que ninguém vê porque quase nunca
     * acontece. */
    const r = estadoSiba({ siba_status: 'a_processar' })
    expect(r.texto).toBeTruthy()
    expect(r.porCumprir).toBe(true)
  })

  it('o desconhecido conta como por comunicar, não como comunicado', () => {
    expect(estadoSiba({ siba_status: 'seja_o_que_for' }).chave).toBe('nao_submetido')
  })

  it('comunicado diz quando e por que caminho', () => {
    const r = estadoSiba({
      siba_status: 'submetido',
      siba_submitted_at: '2026-08-14T10:00:00Z',
      siba_metodo: 'csv',
    })
    expect(r.tom).toBe('bom')
    expect(r.porCumprir).toBe(false)
    expect(r.detalhe).toContain('portal')
    expect(r.detalhe).toContain('2026')
  })

  it('comunicado sem método continua a ser comunicado', () => {
    // Reservas anteriores à coluna `siba_metodo`.
    const r = estadoSiba({ siba_status: 'submetido', siba_submitted_at: '2026-08-14T10:00:00Z' })
    expect(r.chave).toBe('submetido')
    expect(r.detalhe).toContain('entregue')
  })

  it('a falha mostra o motivo, não a contagem', () => {
    const r = estadoSiba({ siba_status: 'falhou', siba_error: 'Chave de acesso inválida.' })
    expect(r.detalhe).toBe('Chave de acesso inválida.')
    expect(r.porCumprir).toBe(true)
  })

  it('uma tentativa falhada depois de uma entrega diz que houve entrega', () => {
    /* Senão o anfitrião comunica a mesma estadia outra vez, e passa a ter dois
     * boletins para a mesma pessoa no portal. */
    const r = estadoSiba({
      siba_status: 'falhou',
      siba_error: 'Serviço indisponível.',
      siba_submitted_at: '2026-08-10T09:00:00Z',
    })
    expect(r.detalhe).toContain('houve uma entrega')
  })

  it('falha sem motivo guardado ainda assim explica-se', () => {
    expect(estadoSiba({ siba_status: 'falhou' }).detalhe).toBeTruthy()
  })

  it('uma data ilegível não aparece como "Invalid Date"', () => {
    const r = estadoSiba({ siba_status: 'submetido', siba_submitted_at: 'nem-data-é' })
    expect(r.detalhe).not.toContain('Invalid')
  })
})

describe('estaEmAtraso', () => {
  it('passadas as 24 horas da entrada, o pendente passa a atraso', () => {
    expect(estaEmAtraso({ check_in: '2026-08-10' }, '2026-08-12')).toBe(true)
  })

  it('no próprio dia da entrada ainda está dentro do prazo', () => {
    expect(estaEmAtraso({ check_in: '2026-08-12' }, '2026-08-12')).toBe(false)
  })

  it('o que já foi comunicado nunca está em atraso', () => {
    expect(estaEmAtraso(
      { check_in: '2026-01-01', siba_status: 'submetido' },
      '2026-08-12',
    )).toBe(false)
  })

  it('o que falhou continua em atraso — falhar não é cumprir', () => {
    expect(estaEmAtraso(
      { check_in: '2026-08-01', siba_status: 'falhou' },
      '2026-08-12',
    )).toBe(true)
  })

  it('sem entrada não há prazo a contar', () => {
    expect(estaEmAtraso({}, '2026-08-12')).toBe(false)
  })
})
