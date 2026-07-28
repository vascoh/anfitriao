/**
 * Passos de ativação da conta.
 *
 * "Ativação" é o momento em que o produto passa a valer o que promete: uma
 * propriedade, um calendário ligado e um check-in online configurado. Até lá,
 * o anfitrião vê ecrãs vazios e não tem razão para voltar.
 *
 * Lógica pura para ser testável e para os vários sítios que a mostram
 * (`/hoje`, `/conta/bem-vindo`) concordarem sempre no que falta.
 */

export interface EstadoConta {
  temPropriedade: boolean
  temIcal: boolean
  temReserva: boolean
  temConformidade: boolean
  siteAtivo: boolean
}

export interface PassoOnboarding {
  chave: 'propriedade' | 'ical' | 'reserva' | 'conformidade' | 'site'
  titulo: string
  descricao: string
  cta: string
  href: string
  feito: boolean
  /** Passos opcionais não bloqueiam a conclusão do onboarding. */
  opcional: boolean
}

export function passosOnboarding(e: EstadoConta): PassoOnboarding[] {
  return [
    {
      chave: 'propriedade',
      titulo: 'Adiciona o teu primeiro alojamento',
      descricao: 'Nome, localização e capacidade. Menos de dois minutos.',
      cta: e.temPropriedade ? 'Ver alojamentos' : 'Adicionar alojamento',
      href: e.temPropriedade ? '/propriedades' : '/propriedades/nova',
      feito: e.temPropriedade,
      opcional: false,
    },
    {
      chave: 'ical',
      titulo: 'Liga o Airbnb e o Booking.com',
      descricao: 'Cola o link iCal de cada plataforma e as reservas entram sozinhas.',
      cta: 'Ligar calendários',
      href: '/propriedades',
      feito: e.temIcal,
      opcional: false,
    },
    {
      chave: 'reserva',
      titulo: 'Confirma a primeira reserva',
      descricao: 'Vinda das plataformas ou criada à mão — é o que faz o painel ganhar vida.',
      cta: 'Ver reservas',
      href: '/reservas',
      feito: e.temReserva,
      opcional: false,
    },
    {
      chave: 'conformidade',
      titulo: 'Preenche o cofre de conformidade',
      descricao: 'RNAL, seguro e Livro de Reclamações. Avisamos-te antes de expirarem.',
      cta: 'Abrir conformidade',
      href: '/conformidade',
      feito: e.temConformidade,
      opcional: false,
    },
    {
      chave: 'site',
      titulo: 'Publica o teu site de reservas diretas',
      descricao: 'Partilha o link com hóspedes repetentes e evita a comissão da plataforma.',
      cta: 'Configurar site',
      href: '/website',
      feito: e.siteAtivo,
      opcional: true,
    },
  ]
}

export interface ProgressoOnboarding {
  passos: PassoOnboarding[]
  /** Próximo passo obrigatório por fazer, se houver. */
  proximo?: PassoOnboarding
  feitos: number
  total: number
  /** Percentagem 0–100, contando só os obrigatórios. */
  percentagem: number
  completo: boolean
}

export function progressoOnboarding(e: EstadoConta): ProgressoOnboarding {
  const passos = passosOnboarding(e)
  const obrigatorios = passos.filter(p => !p.opcional)
  const feitos = obrigatorios.filter(p => p.feito).length
  const total = obrigatorios.length

  return {
    passos,
    proximo: obrigatorios.find(p => !p.feito),
    feitos,
    total,
    percentagem: total === 0 ? 100 : Math.round((feitos / total) * 100),
    completo: feitos === total,
  }
}
