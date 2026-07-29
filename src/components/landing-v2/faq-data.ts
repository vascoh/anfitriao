import { limiteDePropriedades, TRIAL_DIAS } from '@/lib/planos'

/**
 * Fonte única das perguntas frequentes: alimenta o acordeão e o
 * FAQPage JSON-LD da homepage. Editar aqui mantém os dois em sincronia.
 * Os limites e prazos vêm de `lib/planos.ts` — a copy não pode contradizer
 * o que a secção de preços mostra.
 */
export const PERGUNTAS = [
  {
    pergunta: 'Preciso de ter todas as plataformas integradas?',
    resposta:
      'Não. Podes começar com uma só — o Airbnb, por exemplo — e ligas as restantes quando quiseres. A sincronização é feita por iCal, o formato que todas as grandes plataformas suportam.',
  },
  {
    pergunta: 'Quanto tempo poupo por mês?',
    resposta:
      'Depende do número de propriedades e do volume de reservas. Os anfitriões que centralizam calendário, mensagens e check-in costumam reduzir de forma significativa o tempo gasto em tarefas administrativas repetidas.',
  },
  {
    pergunta: 'Posso ter várias propriedades?',
    resposta:
      `Sim. O plano Starter cobre ${limiteDePropriedades('starter')} e o Pro ${limiteDePropriedades('pro')}. Acima disso temos planos Enterprise à medida — escreve para suporte@anfitrioes.pt. Podes mudar de plano a qualquer momento, sem perder dados.`,
  },
  {
    pergunta: 'Que apoio está incluído?',
    resposta:
      'Apoio por email em todos os planos, em português, por quem conhece a lei portuguesa do Alojamento Local. O plano Pro tem prioridade na resposta.',
  },
  {
    pergunta: 'Existe período experimental?',
    resposta:
      `Sim — ${TRIAL_DIAS} dias grátis com acesso a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito para começar.`,
  },
  {
    // Recuperado da landing anterior: é um compromisso comercial já publicado.
    pergunta: 'E se pagar e não gostar?',
    resposta:
      'Devolvemos o dinheiro. Tens 30 dias a partir do primeiro pagamento para pedir reembolso total, sem justificação e sem perguntas. Basta escreveres para suporte@anfitrioes.pt.',
  },
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta:
      'Podes. A subscrição é mensal e cancela-se a partir da tua conta, sem período de fidelização e sem ter de falar com ninguém. Os teus dados ficam disponíveis para exportação.',
  },
] as const
