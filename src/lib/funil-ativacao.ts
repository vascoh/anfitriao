import { geraObrigacoesDeHospede } from './reservations'
import type { BookingSource } from './types'

/**
 * Funil de ativação — onde cada anfitrião fica parado.
 *
 * O item 0.4 pedia um funil no PostHog. Os passos que importam são todos
 * factos que já estão na base, e contá-los aqui não precisa de credenciais nem
 * de pôr um script de tracking no browser de ninguém. Ordem: conta →
 * propriedade → calendário a sincronizar → site publicado → 1.ª reserva real →
 * 1.º check-in online.
 *
 * Um passo conta-se por si: um anfitrião pode publicar o site sem ter ligado
 * calendário. «Parado em» é o **primeiro** passo que falta — é aí que a ajuda
 * serve de alguma coisa.
 *
 * Datas: só onde a base as guarda. A primeira sincronização de um calendário
 * não fica registada (o `last_sync` é reescrito a cada leitura) nem a data em
 * que o site foi publicado, e nesses dois passos o funil diz que se chegou lá,
 * não quando.
 */

export const PASSOS = [
  { chave: 'conta', titulo: 'Conta criada' },
  { chave: 'propriedade', titulo: '1.ª propriedade' },
  { chave: 'calendario', titulo: 'Calendário a sincronizar' },
  { chave: 'site', titulo: 'Site publicado' },
  { chave: 'reserva', titulo: '1.ª reserva real' },
  { chave: 'checkin', titulo: '1.º check-in online' },
] as const

export type Passo = (typeof PASSOS)[number]['chave']

export interface ContaFunil {
  clerk_user_id: string
  email: string
  nome?: string | null
  criado_em: string
  estado: string
}

export interface PropriedadeFunil {
  owner_id: string | null
  criado_em: string
  ical_feeds?: Array<{ last_sync?: string | null; error?: string | null }> | null
}

export interface ReservaFunil {
  owner_id: string | null
  criado_em: string
  hospede_id?: string | null
  uid_externo?: string | null
  notas?: string | null
  origem: BookingSource
  estado: string
  historico?: unknown
}

export interface SiteFunil {
  owner_id: string | null
  enabled: boolean
  slug?: string | null
}

export interface LinhaFunil {
  clerkUserId: string
  email: string
  nome: string | null
  estado: string
  interna: boolean
  /** Data em que chegou a cada passo; `true` se chegou sem data conhecida. */
  passos: Partial<Record<Passo, string | true>>
  paradoEm: Passo | null
  diasDesdeRegisto: number
}

export interface Funil {
  linhas: LinhaFunil[]
  /** Contas externas (sem a interna) que chegaram a cada passo. */
  totais: Record<Passo, number>
  externas: number
}

const menor = (a: string | undefined, b: string) => (a === undefined || b < a ? b : a)

function dataDoCheckin(historico: unknown): string | null {
  if (!Array.isArray(historico)) return null
  const datas = historico
    .filter((h): h is { tipo: string; data: string } =>
      !!h && typeof h === 'object' && (h as { tipo?: unknown }).tipo === 'checkin_online' &&
      typeof (h as { data?: unknown }).data === 'string')
    .map(h => h.data)
    .sort()
  return datas[0] ?? null
}

export function calcularFunil(dados: {
  contas: ContaFunil[]
  propriedades: PropriedadeFunil[]
  reservas: ReservaFunil[]
  sites: SiteFunil[]
  adminUserId?: string | null
  agora?: Date
}): Funil {
  const agora = dados.agora ?? new Date()
  const porDono = <T extends { owner_id: string | null }>(itens: T[]) => {
    const m = new Map<string, T[]>()
    for (const i of itens) {
      if (!i.owner_id) continue
      m.set(i.owner_id, [...(m.get(i.owner_id) ?? []), i])
    }
    return m
  }
  const props = porDono(dados.propriedades)
  const reservas = porDono(dados.reservas)
  const sites = porDono(dados.sites)

  const linhas: LinhaFunil[] = dados.contas.map(c => {
    const passos: LinhaFunil['passos'] = { conta: c.criado_em }
    let primeiraProp: string | undefined
    let calendario = false
    for (const p of props.get(c.clerk_user_id) ?? []) {
      primeiraProp = menor(primeiraProp, p.criado_em)
      if ((p.ical_feeds ?? []).some(f => f.last_sync && !f.error)) calendario = true
    }
    if (primeiraProp) passos.propriedade = primeiraProp
    if (calendario) passos.calendario = true
    if ((sites.get(c.clerk_user_id) ?? []).some(s => s.enabled && s.slug)) passos.site = true

    let primeiraReserva: string | undefined
    let primeiroCheckin: string | undefined
    for (const r of reservas.get(c.clerk_user_id) ?? []) {
      if (r.estado === 'cancelada') continue
      if (!geraObrigacoesDeHospede({ ...r, uid_externo: r.uid_externo ?? undefined, notas: r.notas ?? undefined, hospede_id: r.hospede_id ?? null })) continue
      primeiraReserva = menor(primeiraReserva, r.criado_em)
      const ci = dataDoCheckin(r.historico)
      if (ci) primeiroCheckin = menor(primeiroCheckin, ci)
    }
    if (primeiraReserva) passos.reserva = primeiraReserva
    if (primeiroCheckin) passos.checkin = primeiroCheckin

    const paradoEm = PASSOS.find(p => passos[p.chave] === undefined)?.chave ?? null
    return {
      clerkUserId: c.clerk_user_id,
      email: c.email,
      nome: c.nome ?? null,
      estado: c.estado,
      interna: !!dados.adminUserId && c.clerk_user_id === dados.adminUserId,
      passos,
      paradoEm,
      diasDesdeRegisto: Math.floor((agora.getTime() - new Date(c.criado_em).getTime()) / 86_400_000),
    }
  })

  const externas = linhas.filter(l => !l.interna)
  const totais = Object.fromEntries(
    PASSOS.map(p => [p.chave, externas.filter(l => l.passos[p.chave] !== undefined).length]),
  ) as Record<Passo, number>

  return {
    linhas: linhas.sort((a, b) => b.passos.conta!.toString().localeCompare(a.passos.conta!.toString())),
    totais,
    externas: externas.length,
  }
}
