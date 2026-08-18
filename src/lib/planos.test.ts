import { describe, it, expect } from 'vitest'
import {
  PLAN_LIMITS, PLAN_PRICE_EUR, PLAN_PRICE_EUR_ANUAL, PLANOS_PAGOS, PLAN_NOME,
  precoMensal, precoPorUnidade, limiteDeUnidades, limiteDeUnidadesCapitalizado,
  diasDeTrial,
} from './planos'
import { contarUnidadesReservaveis } from './reservations'

describe('escada de planos', () => {
  it('sobe sempre em preço e em limite', () => {
    // Um escalão que custe mais e dê menos é um erro de tabela que ninguém
    // vê até um cliente o descobrir.
    const ordem = ['starter', 'pro', 'empresa'] as const
    for (let i = 1; i < ordem.length; i++) {
      expect(PLAN_PRICE_EUR[ordem[i]]).toBeGreaterThan(PLAN_PRICE_EUR[ordem[i - 1]])
      expect(PLAN_LIMITS[ordem[i]].propriedades_max)
        .toBeGreaterThan(PLAN_LIMITS[ordem[i - 1]].propriedades_max)
    }
  })

  it('o preço por unidade desce à medida que se sobe', () => {
    // É o argumento comercial: quem cresce paga menos por quarto, não mais.
    expect(precoPorUnidade('pro')).toBeLessThan(precoPorUnidade('starter'))
    expect(precoPorUnidade('empresa')).toBeLessThan(precoPorUnidade('pro'))
  })

  it('o Empresa fica abaixo de 2,50 € por quarto', () => {
    // O número que aparece na landing. Se mudar o preço ou o limite sem
    // mudar a copy, este teste é que avisa.
    expect(precoPorUnidade('empresa')).toBeLessThan(2.5)
  })

  it('o anual é mais barato que o mensal em todos os planos pagos', () => {
    for (const plano of PLANOS_PAGOS) {
      expect(PLAN_PRICE_EUR_ANUAL[plano]).toBeLessThan(PLAN_PRICE_EUR[plano])
      expect(precoMensal(plano, true)).toBe(PLAN_PRICE_EUR_ANUAL[plano])
      expect(precoMensal(plano, false)).toBe(PLAN_PRICE_EUR[plano])
    }
  })

  it('o desconto anual anunciado é de facto ~20%', () => {
    for (const plano of PLANOS_PAGOS) {
      const desconto = 1 - PLAN_PRICE_EUR_ANUAL[plano] / PLAN_PRICE_EUR[plano]
      expect(desconto).toBeGreaterThanOrEqual(0.15)
      expect(desconto).toBeLessThanOrEqual(0.25)
    }
  })

  it('todos os planos têm nome e limite', () => {
    for (const plano of ['trial', ...PLANOS_PAGOS] as const) {
      expect(PLAN_NOME[plano]).toBeTruthy()
      expect(PLAN_LIMITS[plano].propriedades_max).toBeGreaterThan(0)
    }
  })
})

describe('limiteDeUnidades', () => {
  it('fala de quartos e alojamentos, porque o público é dos dois', () => {
    expect(limiteDeUnidades('trial')).toBe('1 quarto ou alojamento')
    expect(limiteDeUnidades('empresa')).toBe('até 40 quartos ou alojamentos')
  })

  it('capitaliza para começo de frase', () => {
    expect(limiteDeUnidadesCapitalizado('pro')).toBe('Até 10 quartos ou alojamentos')
  })
})

describe('contarUnidadesReservaveis', () => {
  const casa = { id: 'casa', parent_id: null, ativo: true }
  const quarto = (n: number) => ({ id: `q${n}`, parent_id: 'casa', ativo: true })

  it('conta apartamentos independentes um a um', () => {
    expect(contarUnidadesReservaveis([
      { id: 'a', parent_id: null, ativo: true },
      { id: 'b', parent_id: null, ativo: true },
      { id: 'c', parent_id: null, ativo: true },
    ])).toBe(3)
  })

  it('uma casa com três quartos são três unidades, não uma', () => {
    // O buraco que o plano Empresa fecha: contando propriedades de topo,
    // isto valia 1 e um hotel inteiro cabia no plano mais barato.
    expect(contarUnidadesReservaveis([casa, quarto(1), quarto(2), quarto(3)])).toBe(3)
  })

  it('uma casa sem quartos é ela própria uma unidade', () => {
    expect(contarUnidadesReservaveis([casa])).toBe(1)
  })

  it('acrescentar o primeiro quarto não gasta unidade nenhuma', () => {
    const antes = contarUnidadesReservaveis([casa])
    const depois = contarUnidadesReservaveis([casa, quarto(1)])
    expect(antes).toBe(1)
    expect(depois).toBe(1)
  })

  it('o segundo quarto já gasta', () => {
    expect(contarUnidadesReservaveis([casa, quarto(1), quarto(2)])).toBe(2)
  })

  it('reativar um quarto desativado acrescenta uma unidade', () => {
    /* É o caminho que a verificação de limite não via: só corria ao criar,
     * portanto quem chegasse ao teto desativava um quarto, criava outro e
     * reativava o primeiro — ficando com mais unidades do que o plano dá. */
    const comDesativado = [casa, quarto(1), { id: 'q2', parent_id: 'casa', ativo: false }]
    const reativado = [casa, quarto(1), quarto(2)]

    expect(contarUnidadesReservaveis(comDesativado)).toBe(1)
    expect(contarUnidadesReservaveis(reativado)).toBe(2)
  })

  it('passar um quarto a alojamento independente também acrescenta', () => {
    const antes = [casa, quarto(1), quarto(2)]
    const depois = [casa, quarto(1), { id: 'q2', parent_id: null, ativo: true }]

    expect(contarUnidadesReservaveis(antes)).toBe(2)
    expect(contarUnidadesReservaveis(depois)).toBe(2)
    // A casa passa a ter um só quarto, logo continua a contar como contentor;
    // o antigo quarto passa a contar por si. O total mantém-se — mas a conta
    // tem de ser feita, e era isso que não acontecia nas alterações.
  })

  it('ignora o que está inativo', () => {
    expect(contarUnidadesReservaveis([
      { id: 'a', parent_id: null, ativo: true },
      { id: 'b', parent_id: null, ativo: false },
    ])).toBe(1)
  })

  it('uma casa cujos quartos foram todos desativados volta a ser alugável', () => {
    expect(contarUnidadesReservaveis([
      casa,
      { id: 'q1', parent_id: 'casa', ativo: false },
    ])).toBe(1)
  })

  it('trata ativo em falta como ativo — o campo é opcional na query', () => {
    expect(contarUnidadesReservaveis([{ id: 'a', parent_id: null }])).toBe(1)
  })

  it('um hotel de 40 quartos são 40 unidades e cabe exatamente no Empresa', () => {
    const hotel = [
      { id: 'hotel', parent_id: null, ativo: true },
      ...Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, parent_id: 'hotel', ativo: true })),
    ]
    expect(contarUnidadesReservaveis(hotel)).toBe(40)
    expect(contarUnidadesReservaveis(hotel)).toBeLessThanOrEqual(PLAN_LIMITS.empresa.propriedades_max)
  })

  it('não conta duas vezes quartos de casas diferentes', () => {
    expect(contarUnidadesReservaveis([
      { id: 'casa1', parent_id: null, ativo: true },
      { id: 'casa2', parent_id: null, ativo: true },
      { id: 'q1', parent_id: 'casa1', ativo: true },
      { id: 'q2', parent_id: 'casa1', ativo: true },
      { id: 'q3', parent_id: 'casa2', ativo: true },
      { id: 'q4', parent_id: 'casa2', ativo: true },
    ])).toBe(4)
  })
})

describe('diasDeTrial', () => {
  const FIM = '2026-08-20T12:00:00Z'

  it('conta os dias que faltam', () => {
    const agora = new Date('2026-08-17T12:00:00Z').getTime()
    expect(diasDeTrial(FIM, agora)).toBe(3)
  })

  it('devolve negativo depois de expirar — não zero', () => {
    /* Uma das quatro versões fazia Math.max(0, …): um trial terminado há
     * cinco dias aparecia como "0 dias restantes" na faturação, enquanto o
     * banner da app dizia que tinha terminado. */
    const agora = new Date('2026-08-25T12:00:00Z').getTime()
    expect(diasDeTrial(FIM, agora)).toBe(-5)
  })

  it('sem data não há conta a fazer', () => {
    expect(diasDeTrial(null)).toBeNull()
    expect(diasDeTrial(undefined)).toBeNull()
    expect(diasDeTrial('não é uma data')).toBeNull()
  })

  it('arredonda para cima: umas horas ainda contam como um dia', () => {
    const agora = new Date('2026-08-20T06:00:00Z').getTime()
    expect(diasDeTrial(FIM, agora)).toBe(1)
  })
})
