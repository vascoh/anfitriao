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
  instrucoes_checkin: string
  regras_casa: string
  preco_base: number
  taxa_limpeza?: number
  cor: string
  ativo: boolean
  criado_em: string
  ical_feeds?: IcalFeed[]
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
