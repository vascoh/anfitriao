import {
  Home, CalendarDays, CalendarCheck2, Building2, TrendingUp, Zap,
  Users, FileText, Tag, ShieldCheck, Globe, Newspaper, Wallet, Sparkles,
  UserRound, CreditCard, Receipt, Rss,
  type LucideIcon,
} from 'lucide-react'

/**
 * Fonte única da navegação da aplicação (side-nav, bottom-nav e ⌘K).
 *
 * Regra: **seis destinos de topo, não mais**. Tudo o resto vive como
 * sub-navegação contextual dentro de uma secção, e só aparece quando essa
 * secção está ativa. A versão anterior tinha 14 destinos ao mesmo nível — o
 * utilizador-alvo (1 a 10 alojamentos, a gerir isto ao fim do dia) não
 * descobria metade deles.
 *
 * Antes de acrescentar um sétimo item de topo: não acrescentar. Encaixá-lo
 * numa das seis secções.
 */

export interface SubItem {
  href: string
  label: string
  Icon: LucideIcon
  /** Texto curto para o ⌘K, quando o label sozinho é ambíguo. */
  descricao?: string
}

export interface NavSection {
  href: string
  label: string
  Icon: LucideIcon
  children?: SubItem[]
}

export const NAV: NavSection[] = [
  {
    href: '/hoje',
    label: 'Hoje',
    Icon: Home,
  },
  {
    href: '/calendario',
    label: 'Calendário',
    Icon: CalendarDays,
  },
  {
    href: '/reservas',
    label: 'Reservas',
    Icon: CalendarCheck2,
    children: [
      { href: '/hospedes', label: 'Hóspedes', Icon: Users, descricao: 'Contactos, notas e histórico' },
      { href: '/documentos', label: 'Documentos SIBA', Icon: FileText, descricao: 'Boletins de alojamento' },
    ],
  },
  {
    href: '/propriedades',
    label: 'Alojamentos',
    Icon: Building2,
    children: [
      /* Nomear só as duas OTA dizia a quem usa um gestor de canais que não era
       * ali — e é ali, e é a ele que se liga. Terceiro sítio com o mesmo
       * engano; os outros dois eram o atalho na ficha do alojamento e a ordem
       * das opções em `CANAIS_IMPORTAVEIS`. */
      { href: '/canais', label: 'Canais', Icon: Rss, descricao: 'Gestor de canais, Airbnb, Booking.com — calendários' },
      { href: '/precos', label: 'Preços', Icon: Tag, descricao: 'Regras, tarifas e plataformas' },
      { href: '/conformidade', label: 'Conformidade', Icon: ShieldCheck, descricao: 'RNAL, seguro, Livro de Reclamações' },
      { href: '/website', label: 'Site de reservas', Icon: Globe, descricao: 'O teu site público' },
      { href: '/blog', label: 'Blog', Icon: Newspaper, descricao: 'Artigos do site público' },
    ],
  },
  {
    href: '/relatorios',
    label: 'Receita',
    Icon: TrendingUp,
    children: [
      { href: '/faturacao', label: 'Faturação', Icon: Receipt, descricao: 'Faturas certificadas e SAF-T' },
      { href: '/financeiro', label: 'Despesas e lucro', Icon: Wallet, descricao: 'Custos, comissões e lucro líquido' },
    ],
  },
  {
    href: '/automacoes',
    label: 'Automação',
    Icon: Zap,
    children: [
      { href: '/concierge', label: 'Concierge IA', Icon: Sparkles, descricao: 'Respostas a hóspedes em 6 idiomas' },
    ],
  },
]

/** Fora da navegação principal — vive no menu de conta. */
export const CONTA_NAV: SubItem[] = [
  { href: '/conta/perfil', label: 'Perfil', Icon: UserRound },
  { href: '/conta/pagamentos', label: 'Pagamentos', Icon: CreditCard },
  { href: '/conta/billing', label: 'Subscrição', Icon: CreditCard },
]

/** True quando `pathname` é `href` ou uma rota abaixo dele. */
export function rotaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Secção de topo a que um caminho pertence — inclui as sub-rotas, para que
 * estar em `/precos` continue a iluminar "Alojamentos".
 */
export function seccaoDe(pathname: string): NavSection | undefined {
  return NAV.find(s =>
    rotaAtiva(pathname, s.href) ||
    s.children?.some(c => rotaAtiva(pathname, c.href)),
  )
}

/** Lista plana de todos os destinos, para pesquisa no ⌘K. */
export function todosOsDestinos(): SubItem[] {
  return [
    ...NAV.map(({ href, label, Icon }) => ({ href, label, Icon })),
    ...NAV.flatMap(s => s.children ?? []),
    ...CONTA_NAV,
  ]
}
