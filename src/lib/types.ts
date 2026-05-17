export type PropertyType = 'apartamento' | 'moradia' | 'quarto' | 'outro'
export type BookingStatus = 'pendente' | 'confirmada' | 'checkin' | 'checkout' | 'cancelada' | 'no_show'
export type BookingSource = 'airbnb' | 'booking' | 'direto' | 'expedia' | 'vrbo' | 'outro'
export type GuestTag = 'vip' | 'problematico' | 'frequente' | 'novo'

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
  tags: GuestTag[]
  notas?: string
  criado_em: string
}

export interface BookingEvent {
  id: string
  data: string
  tipo: 'criada' | 'confirmada' | 'checkin' | 'checkout' | 'cancelada' | 'pagamento' | 'nota'
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
  hospede_id: string
  check_in: string
  check_out: string
  num_hospedes: number
  estado: BookingStatus
  origem: BookingSource
  preco_total: number
  preco_pago: number
  notas?: string
  criado_em: string
  historico: BookingEvent[]
}
