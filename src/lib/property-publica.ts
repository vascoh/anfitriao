import type { Booking, Property } from './types'

/**
 * O que de uma propriedade pode ir para o browser de um desconhecido.
 *
 * As páginas públicas passavam o objeto `Property` inteiro — vindo de um
 * `select('*')` — a componentes de cliente. Tudo o que é prop de um
 * componente `'use client'` vai serializado no HTML da página, portanto
 * qualquer pessoa que abrisse o código-fonte de `/book/[id]` lia:
 *
 * - **as credenciais do SIBA** (`siba_nipc`, `siba_estabelecimento`,
 *   `siba_chave_acesso`, contactos) — as credenciais do anfitrião perante o
 *   Estado, que ele acabou de nos confiar encriptadas;
 * - **os endereços iCal privados** (`ical_feeds`) do Airbnb, Booking ou
 *   Amenitiz, que dão a qualquer pessoa o calendário completo de reservas;
 * - **a morada**, mesmo com `mostrar_morada_publica` a falso — que é uma
 *   definição que o anfitrião pôs lá precisamente para isso não acontecer;
 * - o número de RNAL, a apólice de seguro, o certificado energético.
 *
 * Por isso a regra é **lista de permitidos, não de proibidos**: um campo novo
 * na tabela não passa a ser público por descuido. Quem quiser publicar mais
 * alguma coisa tem de a acrescentar aqui, e isso é uma decisão visível.
 */
export interface PropriedadePublica {
  id: string
  nome: string
  tipo: Property['tipo']
  cidade: string
  capacidade: number
  quartos: number
  casasBanho: number
  comodidades: string[]
  descricao?: string
  imagem_url?: string
  fotos?: string[]
  preco_base: number
  taxa_limpeza?: number
  cor: string
  ativo: boolean
  parent_id?: string | null
  regras_casa?: string
  /** Só existe quando o anfitrião escolheu mostrar a morada. */
  endereco?: string
}

export function propriedadePublica(p: Property): PropriedadePublica {
  return {
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    cidade: p.cidade,
    capacidade: p.capacidade,
    quartos: p.quartos,
    casasBanho: p.casasBanho,
    comodidades: p.comodidades ?? [],
    descricao: p.descricao,
    imagem_url: p.imagem_url,
    fotos: p.fotos,
    preco_base: p.preco_base,
    taxa_limpeza: p.taxa_limpeza,
    cor: p.cor,
    ativo: p.ativo,
    parent_id: p.parent_id,
    regras_casa: p.regras_casa,
    ...(p.mostrar_morada_publica && p.endereco ? { endereco: p.endereco } : {}),
  }
}

export function propriedadesPublicas(props: Property[]): PropriedadePublica[] {
  return props.map(propriedadePublica)
}

/**
 * Ocupação de um alojamento, para o browser poder dizer "estas datas não
 * estão livres" sem receber as reservas.
 *
 * A página da casa inteira recebia `bookings` — **todas as reservas do
 * anfitrião**: datas, id do hóspede, preços, notas (que no iCal trazem o nome
 * de quem reservou), estado do boletim, referências de fatura e do Stripe. O
 * cálculo de disponibilidade só precisa de saber que dias estão tomados.
 */
export interface OcupacaoPublica {
  propriedade_id: string
  check_in: string
  check_out: string
}

const ESTADOS_QUE_NAO_OCUPAM = ['cancelada', 'no_show']

export function ocupacoesPublicas(bookings: Booking[]): OcupacaoPublica[] {
  return bookings
    .filter(b => !ESTADOS_QUE_NAO_OCUPAM.includes(b.estado))
    .map(b => ({
      propriedade_id: b.propriedade_id,
      check_in: b.check_in,
      check_out: b.check_out,
    }))
}

/**
 * O que das definições do site pode ir para o browser.
 *
 * O objeto completo levava o `owner_id` (identificador interno da conta), o
 * email de reservas e a assinatura de email — nada disto é preciso para
 * desenhar um formulário de reserva, e o princípio é o mesmo das
 * propriedades: publica-se o que se escolheu publicar.
 */
export interface DefinicoesPublicas {
  nome: string
  slug?: string | null
  telefone?: string | null
  min_noites?: number | null
  antecedencia_dias?: number | null
  /** Aparência do site do anfitrião — feita para ser vista. */
  cor_primaria?: string | null
  fonte?: string | null
}

export function definicoesPublicas(ws: {
  nome?: string
  slug?: string | null
  telefone?: string | null
  min_noites?: number | null
  antecedencia_dias?: number | null
  cor_primaria?: string | null
  fonte?: string | null
}): DefinicoesPublicas {
  return {
    nome: ws.nome ?? '',
    slug: ws.slug ?? null,
    telefone: ws.telefone ?? null,
    min_noites: ws.min_noites ?? null,
    antecedencia_dias: ws.antecedencia_dias ?? null,
    cor_primaria: ws.cor_primaria ?? null,
    fonte: ws.fonte ?? null,
  }
}
