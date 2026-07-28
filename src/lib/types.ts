export type PropertyType = 'apartamento' | 'moradia' | 'quarto' | 'outro'
export type BookingStatus = 'pendente' | 'confirmada' | 'checkin' | 'checkout' | 'cancelada' | 'no_show'
export type BookingSource = 'airbnb' | 'booking' | 'direto' | 'expedia' | 'vrbo' | 'outro'
export type GuestTag = 'vip' | 'problematico' | 'frequente' | 'novo'
export type PriceRuleTipo = 'custom' | 'seasonal' | 'weekend' | 'holiday' | 'promo' | 'long_stay'
export type TarifaTipo = 'standard' | 'non_refundable' | 'breakfast' | 'long_stay' | 'promo' | 'corporate' | 'ota' | 'seasonal'

export interface IcalFeed {
  id: string
  url: string
  source: BookingSource
  nome: string
  last_sync?: string
  last_count?: number
  error?: string
}

export interface Property {
  id: string
  nome: string
  tipo: PropertyType
  endereco: string
  cidade: string
  capacidade: number
  quartos: number
  casasBanho: number
  comodidades: string[]
  descricao?: string
  imagem_url?: string
  /** Fotos adicionais para a galeria do site público (além da foto principal) */
  fotos?: string[]
  /** Se true, a página /localizacao do site público mostra a morada completa; default false (só mostra a cidade) */
  mostrar_morada_publica?: boolean
  instrucoes_checkin: string
  regras_casa: string
  preco_base: number
  taxa_limpeza?: number
  cor: string
  ativo: boolean
  criado_em: string
  ical_feeds?: IcalFeed[]
  /** If set, this property is a room inside the parent property */
  parent_id?: string | null
  owner_id?: string | null

  // ─── Cofre de conformidade (migration 027) ───────────────────────────
  // Base legal de cada campo documentada em lib/compliance.ts
  /** Número de registo no RNAL — obrigatório em toda a publicidade */
  rnal_numero?: string | null
  rnal_data?: string | null
  seguro_seguradora?: string | null
  seguro_apolice?: string | null
  seguro_validade?: string | null
  livro_reclamacoes_registado?: boolean | null
  livro_reclamacoes_url?: string | null
  certificado_energetico_validade?: string | null
}

export interface Guest {
  id: string
  nome: string
  email?: string
  telefone?: string
  nacionalidade?: string
  numero_documento?: string
  data_nascimento?: string
  tipo_documento?: string
  sexo?: string
  pais_emissao?: string
  data_validade_doc?: string
  tags: GuestTag[]
  notas?: string
  criado_em: string
  owner_id?: string
}

export interface BookingEvent {
  id: string
  data: string
  tipo: 'criada' | 'confirmada' | 'checkin' | 'checkout' | 'cancelada' | 'no_show' | 'pagamento' | 'nota' | 'checkin_online' | 'pagamento_lembrete'
  descricao: string
}

export interface WebsiteSettings {
  enabled: boolean
  nome: string
  descricao: string
  logo_texto?: string
  host_nome?: string
  host_bio?: string
  email: string
  telefone: string
  min_noites: number
  antecedencia_dias: number
  /** Unique URL slug for the host's public booking site (e.g. "casadevasco") */
  slug?: string
  /** Clerk userId of the host who owns these settings */
  owner_id?: string
  /** Identidade de email do alojamento (ver lib/email/identity.ts) */
  cor_primaria?: string | null
  cor_secundaria?: string | null
  idioma?: string | null
  /** Reply-To dos emails ao hóspede; se vazio usa `email` */
  email_reservas?: string | null
  assinatura_email?: string | null
  /** Template do site público (ver website_templates); 'classico' por omissão */
  template_id?: string | null
  /** Família tipográfica do site público: null/undefined = default, 'serif', 'arredondada' */
  fonte?: string | null
  /** Conteúdo opcional por secção do site público (hoje: só FAQ) */
  secoes?: { faq?: Array<{ pergunta: string; resposta: string }> } | null
}

export interface WebsiteTemplate {
  id: string
  nome: string
  descricao: string
}

export type ExpenseCategoria = 'limpeza' | 'manutencao' | 'comissoes' | 'utilidades' | 'marketing' | 'iva' | 'outro'

export type AutomationTrigger = 'checkin_amanha' | 'checkout_hoje' | 'pedir_avaliacao'
export type AutomationAction = 'email_hospede'

export interface Automation {
  id: string
  owner_id?: string | null
  nome: string
  trigger_tipo: AutomationTrigger
  action_tipo: AutomationAction
  assunto: string
  mensagem: string
  ativo: boolean
  criado_em: string
}

export interface Expense {
  id: string
  propriedade_id?: string | null
  categoria: ExpenseCategoria
  descricao: string
  valor: number
  data: string
  owner_id?: string | null
  criado_em: string
}

export interface Post {
  id: string
  owner_id?: string | null
  slug: string
  titulo: string
  /** Texto curto usado na lista do blog; se vazio, deriva-se do início de `conteudo` */
  resumo?: string | null
  /** Texto simples — parágrafos separados por linha em branco, sem markdown/HTML */
  conteudo: string
  imagem_capa?: string | null
  publicado: boolean
  criado_em: string
  atualizado_em?: string
}

export interface Booking {
  id: string
  propriedade_id: string
  hospede_id: string | null
  check_in: string
  check_out: string
  num_hospedes: number
  estado: BookingStatus
  origem: BookingSource
  preco_total: number
  preco_pago: number
  notas?: string
  uid_externo?: string
  criado_em: string
  historico: BookingEvent[]
  owner_id?: string
  // ─── Faturação certificada (migration 028) ───────────────────────────
  // O documento legal vive no fornecedor certificado; aqui só a referência.
  fatura_estado?: 'nao_emitida' | 'a_emitir' | 'emitida' | 'falhou'
  fatura_id_externo?: string | null
  fatura_numero?: string | null
  fatura_atcud?: string | null
  fatura_url?: string | null
  fatura_total?: number | null
  fatura_emitida_em?: string | null
  fatura_erro?: string | null

  /** Estado da submissão automática à AIMA/SIBA (ver lib/siba-api.ts) */
  siba_status?: 'nao_submetido' | 'a_processar' | 'submetido' | 'falhou'
  siba_submitted_at?: string | null
  siba_reference?: string | null
  siba_error?: string | null
}

// --- Sistema de preços ---

export interface PriceRule {
  id: string
  property_id: string
  nome: string
  tipo: PriceRuleTipo
  data_inicio?: string     // YYYY-MM-DD (inclusive)
  data_fim?: string        // YYYY-MM-DD (inclusive)
  dias_semana?: number[]   // 0=Dom, 1=Seg, ..., 6=Sab (undefined = todos)
  preco_noite?: number     // override ao preço base
  taxa_limpeza?: number    // override à taxa de limpeza
  desconto_pct?: number    // ajuste: -10 = -10%, +20 = +20%
  min_noites?: number
  max_noites?: number
  prioridade: number       // maior valor vence quando há sobreposição
  ativo: boolean
  criado_em: string
}

export interface Tarifa {
  id: string
  property_id: string
  nome: string
  tipo: TarifaTipo
  desconto_pct: number      // -10 = 10% desconto, 0 = sem alteração
  suplemento_valor: number  // suplemento fixo em euros por reserva
  min_noites: number
  max_noites?: number
  cancelamento_horas?: number
  politica_cancelamento?: string
  plataformas?: BookingSource[]
  ativo: boolean
  criado_em: string
}

export interface PlatformRate {
  id: string
  property_id: string
  plataforma: BookingSource
  multiplicador: number   // 1.15 = preço base × 1.15 (+15%)
  comissao_pct: number    // % de comissão da plataforma
  ativo: boolean
  criado_em: string
}

export interface PricingBreakdown {
  preco_noite: number
  num_noites: number
  subtotal_noites: number
  taxa_limpeza: number
  ajuste_pct: number         // de desconto_pct
  ajuste_valor: number       // valor em euros do ajuste
  plataforma_multiplicador: number
  plataforma_ajuste: number  // diferença em euros do multiplicador
  total: number
  regra_aplicada?: string
  tarifa_aplicada?: string
}
