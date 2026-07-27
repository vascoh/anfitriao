/**
 * Páginas de comparação (`/vs/[slug]`) — tráfego de alta intenção comercial.
 *
 * ⚠️ Regra editorial: os dados de preço da concorrência são públicos, datados
 * (ver `precosVerificadosEm`) e acompanhados da fonte. Nunca inventar números
 * nem omitir onde o concorrente é genuinamente melhor — a secção
 * `ondeElesGanham` é obrigatória em cada entrada. Uma comparação que só elogia
 * o próprio produto não converte e expõe-nos a queixa por publicidade
 * comparativa enganosa (DL 57/2008).
 */

export const PRECOS_VERIFICADOS_EM = '2026-07-27'

export type Linha = { label: string; nos: boolean | 'parcial'; eles: boolean | 'parcial'; nota?: string }

export interface Concorrente {
  slug: string
  nome: string
  tagline: string
  precoResumo: string
  precoNota: string
  fonte: string
  posicionamento: string
  ondeElesGanham: string[]
  ondeNosGanhamos: string[]
  tabela: Linha[]
  veredito: string
  naoEscolhasNos: string
}

export const CONCORRENTES: Concorrente[] = [
  {
    slug: 'smoobu',
    nome: 'Smoobu',
    tagline: 'O mais completo da Europa central — e o mais caro por propriedade.',
    precoResumo: '€26,10/mês por propriedade + 0,9% por reserva',
    precoNota: 'O plano Professional Pre-paid custa €31,50/mês por propriedade sem comissão. O preço dinâmico é um extra de €12,99/mês por propriedade.',
    fonte: 'https://www.smoobu.com/en/prices/',
    posicionamento: 'Produto maduro, forte na Alemanha, Áustria e Suíça. Portugal é mercado secundário: o suporte, a documentação e as obrigações legais são pensados para o mercado DACH.',
    ondeElesGanham: [
      'Ligação por API ao Booking.com, não só iCal — a sincronização é praticamente instantânea.',
      'Muito mais integrações de terceiros (fechaduras, limpezas, preço dinâmico).',
      'Anos de maturidade e uma base de clientes grande, com o produto testado à escala.',
    ],
    ondeNosGanhamos: [
      'Preço por conta, não por propriedade. Com 3 alojamentos o Smoobu custa-te mais de €78/mês.',
      'Check-in online desenhado para o boletim de alojamento português, com os campos exatos do SIBA.',
      'Interface e suporte em português de Portugal, não traduzido.',
      'Zero comissão sobre reservas, em qualquer plano.',
    ],
    tabela: [
      { label: 'Preço por conta (não por propriedade)', nos: true, eles: false },
      { label: 'Comissão sobre reservas', nos: true, eles: 'parcial', nota: 'O Anfitrião nunca cobra. O Smoobu cobra 0,9% no plano Flex.' },
      { label: 'Sincronização iCal', nos: true, eles: true },
      { label: 'Ligação por API ao Booking.com', nos: false, eles: true },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: 'parcial' },
      { label: 'Leitura do documento por foto (OCR)', nos: true, eles: 'parcial' },
      { label: 'Site de reservas diretas incluído', nos: true, eles: true },
      { label: 'Assistente de IA para responder a hóspedes', nos: true, eles: false },
      { label: 'Interface e suporte em português de Portugal', nos: true, eles: false },
      { label: 'Preço dinâmico', nos: false, eles: 'parcial', nota: 'No Smoobu é um extra pago. No Anfitrião está em desenvolvimento.' },
    ],
    veredito: 'Se geres 1 propriedade e queres a ligação API ao Booking.com acima de tudo, o Smoobu é uma escolha sólida. A partir de 2 propriedades a conta muda de figura: pagas por cada uma, e nada disso te ajuda com a papelada portuguesa.',
    naoEscolhasNos: 'Se a tua prioridade absoluta é sincronização instantânea via API com o Booking.com, hoje o Smoobu faz isso e o Anfitrião ainda não.',
  },
  {
    slug: 'lodgify',
    nome: 'Lodgify',
    tagline: 'Excelente construtor de sites. Preço por anúncio que escala mal.',
    precoResumo: 'Desde $20/mês por anúncio, com mínimo de $100 até 5 anúncios',
    precoNota: 'Acresce uma taxa de 1,9% sobre reservas em alguns planos. O preço dinâmico é cobrado a 0,8% por reserva concluída.',
    fonte: 'https://www.lodgify.com/pricing/',
    posicionamento: 'O ponto forte histórico do Lodgify é o construtor de sites de reservas diretas, que é dos melhores do mercado, com domínio próprio e SEO a sério.',
    ondeElesGanham: [
      'Construtor de sites mais maduro, com domínio próprio, templates e SEO trabalhado.',
      'Ligações por API a várias plataformas, não só iCal.',
      'Produto disponível em muitas línguas, com presença comercial em Portugal.',
    ],
    ondeNosGanhamos: [
      'Preço por conta. No Lodgify, 5 anúncios custam no mínimo $100/mês — mais de 5× o nosso plano equivalente.',
      'Sem taxa por reserva. O Lodgify cobra até 1,9% em alguns planos.',
      'Check-in online e boletim SIBA feitos para a lei portuguesa.',
      'Assistente de IA incluído, sem custo por utilização.',
    ],
    tabela: [
      { label: 'Preço por conta (não por anúncio)', nos: true, eles: false },
      { label: 'Sem mínimo obrigatório de faturação', nos: true, eles: false },
      { label: 'Comissão sobre reservas', nos: true, eles: false, nota: 'O Lodgify cobra até 1,9% em alguns planos.' },
      { label: 'Site de reservas diretas', nos: true, eles: true },
      { label: 'Domínio próprio no site', nos: 'parcial', eles: true, nota: 'No Anfitrião está planeado; hoje o site vive num endereço partilhado.' },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: false },
      { label: 'Assistente de IA para hóspedes', nos: true, eles: 'parcial' },
      { label: 'Interface e suporte em português de Portugal', nos: true, eles: 'parcial' },
    ],
    veredito: 'Se o teu negócio vive do site de reservas diretas e estás disposto a pagar por isso, o Lodgify é bom. Se tens 2 a 6 alojamentos e queres previsibilidade de custo, o modelo por anúncio do Lodgify torna-se caro depressa.',
    naoEscolhasNos: 'Se precisas hoje de um site com domínio próprio e SEO forte, o Lodgify está à frente. No Anfitrião o domínio próprio ainda está por lançar.',
  },
  {
    slug: 'guesty',
    nome: 'Guesty',
    tagline: 'Feito para quem gere centenas de unidades. Não para ti, provavelmente.',
    precoResumo: 'Sob consulta, tipicamente acima de $100/mês por unidade',
    precoNota: 'O Guesty não publica preços. O modelo é empresarial, com contrato, implementação e gestor de conta.',
    fonte: 'https://www.guesty.com/pricing/',
    posicionamento: 'O Guesty é a referência para empresas de gestão com portefólios grandes: contabilidade de terceiros, portal de proprietários, automação profunda e ligações API a todas as plataformas.',
    ondeElesGanham: [
      'Ligações API nativas a praticamente todas as OTAs relevantes.',
      'Contabilidade e repartição de receitas por proprietário, ao nível empresarial.',
      'Automação, relatórios e permissões muito mais profundos.',
      'Suporta operações com centenas ou milhares de unidades.',
    ],
    ondeNosGanhamos: [
      'Preço. O Guesty custa mais numa unidade do que o Anfitrião custa numa conta inteira.',
      'Sem contrato, sem taxa de implementação, sem processo de vendas — crias conta e começas.',
      'Feito para a lei portuguesa, não adaptado a ela.',
      'Simplicidade: o Guesty é uma ferramenta para equipas dedicadas, não para quem gere o alojamento ao fim de semana.',
    ],
    tabela: [
      { label: 'Começar sem falar com um comercial', nos: true, eles: false },
      { label: 'Preço público e previsível', nos: true, eles: false },
      { label: 'Sem contrato nem taxa de implementação', nos: true, eles: false },
      { label: 'Ligações API a todas as OTAs', nos: false, eles: true },
      { label: 'Portal de proprietários', nos: false, eles: true },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: 'parcial' },
      { label: 'Adequado a 1–10 alojamentos', nos: true, eles: false },
      { label: 'Adequado a mais de 100 unidades', nos: false, eles: true },
    ],
    veredito: 'O Guesty e o Anfitrião não competem pelo mesmo cliente. Se geres mais de 50 unidades com uma equipa dedicada, o Guesty faz sentido. Se tens entre 1 e 10 alojamentos, estás a pagar por complexidade que nunca vais usar.',
    naoEscolhasNos: 'Se geres dezenas de unidades para terceiros e precisas de contabilidade por proprietário e permissões por equipa, o Guesty resolve isso hoje e o Anfitrião ainda não.',
  },
  {
    slug: 'hostaway',
    nome: 'Hostaway',
    tagline: 'Poderoso, mas com contrato anual e taxa de implementação.',
    precoResumo: 'Sob consulta, tipicamente $50–100+/mês, com taxa de implementação',
    precoNota: 'O Hostaway trabalha habitualmente com compromisso anual e cobra implementação inicial. O preço não é público.',
    fonte: 'https://www.hostaway.com/pricing/',
    posicionamento: 'Channel manager forte com API real às principais OTAs e um mercado grande de integrações. Orientado a gestores profissionais.',
    ondeElesGanham: [
      'Ligações API reais ao Airbnb, Booking.com, Vrbo e Expedia.',
      'Mercado de integrações extenso.',
      'Ferramentas de equipa e automação maduras.',
    ],
    ondeNosGanhamos: [
      'Sem contrato anual e sem taxa de implementação.',
      'Preço público, por conta, a partir de zero.',
      'Compliance portuguesa como funcionalidade central, não como pedido de cliente.',
      'Podes estar a funcionar em 10 minutos, sozinho.',
    ],
    tabela: [
      { label: 'Sem contrato anual', nos: true, eles: false },
      { label: 'Sem taxa de implementação', nos: true, eles: false },
      { label: 'Preço público', nos: true, eles: false },
      { label: 'Ligações API às OTAs', nos: false, eles: true },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: 'parcial' },
      { label: 'Gestão de equipas e permissões', nos: false, eles: true },
      { label: 'Assistente de IA incluído', nos: true, eles: 'parcial' },
    ],
    veredito: 'O Hostaway é uma boa ferramenta profissional se já tens escala e equipa. Para um anfitrião independente, o contrato anual e a taxa de implementação são fricção difícil de justificar.',
    naoEscolhasNos: 'Se precisas de API às OTAs e de gestão de equipas com permissões, o Hostaway está à frente do Anfitrião hoje.',
  },
  {
    slug: 'hospitable',
    nome: 'Hospitable',
    tagline: 'A melhor automação de mensagens do mercado. E pouco mais.',
    precoResumo: 'Plano gratuito limitado; planos pagos desde cerca de $29/mês',
    precoNota: 'O preço sobe com o número de anúncios. Cerca de $32/mês para 5 anúncios em alguns planos.',
    fonte: 'https://hospitable.com/pricing/',
    posicionamento: 'O Hospitable é essencialmente uma máquina de automatizar mensagens a hóspedes, e faz isso melhor do que qualquer outro. Não tenta ser um PMS completo.',
    ondeElesGanham: [
      'Automação de mensagens claramente superior, com respostas dentro da própria caixa do Airbnb.',
      'Tem plano gratuito.',
      'Muito fiável no que se propõe fazer.',
    ],
    ondeNosGanhamos: [
      'Check-in online, boletim SIBA e documentação legal portuguesa — o Hospitable não tem nada disto.',
      'Relatórios de receita, despesas, comissões por plataforma e lucro líquido.',
      'Site de reservas diretas com pagamento incluído.',
      'Regras de preço por época, fim de semana e estadia mínima.',
    ],
    tabela: [
      { label: 'Automação de mensagens ao hóspede', nos: 'parcial', eles: true, nota: 'O Hospitable é melhor aqui. O Anfitrião tem 3 gatilhos por email.' },
      { label: 'Resposta dentro da caixa do Airbnb', nos: false, eles: true },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: false },
      { label: 'Relatórios de receita e despesas', nos: true, eles: false },
      { label: 'Site de reservas diretas', nos: true, eles: 'parcial' },
      { label: 'Regras de preço', nos: true, eles: false },
      { label: 'Feito para a lei portuguesa', nos: true, eles: false },
    ],
    veredito: 'Muitos anfitriões usam o Hospitable só para as mensagens e depois continuam a tratar do SIBA, das contas e dos relatórios à mão. O Anfitrião cobre a parte que o Hospitable deixa de fora.',
    naoEscolhasNos: 'Se a automação de mensagens é o teu único problema e queres o melhor que existe nisso, o Hospitable é honestamente melhor do que o Anfitrião hoje.',
  },
  {
    slug: 'amenitiz',
    nome: 'Amenitiz',
    tagline: 'Muita força comercial, produto genérico, preço alto.',
    precoResumo: 'Tipicamente acima de €100/mês',
    precoNota: 'O preço depende de negociação comercial e do número de unidades. Não é público.',
    fonte: 'https://www.amenitiz.com/',
    posicionamento: 'Presença comercial forte em Espanha e Portugal, com equipa de vendas ativa. O produto assenta muito no construtor de site e no motor de reservas.',
    ondeElesGanham: [
      'Equipa comercial e de apoio presente em Portugal, com acompanhamento telefónico.',
      'Motor de reservas maduro, orientado também a pequenos hotéis e guest houses.',
    ],
    ondeNosGanhamos: [
      'Preço: uma fração do custo, sem processo de vendas.',
      'Produto pensado para Alojamento Local, não para hotelaria em geral.',
      'Check-in online e boletim SIBA como funcionalidade central.',
      'Assistente de IA incluído.',
    ],
    tabela: [
      { label: 'Preço público e previsível', nos: true, eles: false },
      { label: 'Começar sem falar com um comercial', nos: true, eles: false },
      { label: 'Check-in online com campos do SIBA', nos: true, eles: 'parcial' },
      { label: 'Site de reservas diretas', nos: true, eles: true },
      { label: 'Assistente de IA para hóspedes', nos: true, eles: false },
      { label: 'Vocacionado para pequenos hotéis', nos: false, eles: true },
    ],
    veredito: 'Se procuras um fornecedor com equipa comercial ao telefone e não te importas com o custo, o Amenitiz responde a isso. Se queres o melhor produto por euro gasto, a comparação não é favorável.',
    naoEscolhasNos: 'Se geres uma guest house ou um hotel pequeno com receção física, o Amenitiz está mais bem adaptado a esse formato.',
  },
]

export function comparacaoPorSlug(slug: string) {
  return CONCORRENTES.find(c => c.slug === slug)
}
