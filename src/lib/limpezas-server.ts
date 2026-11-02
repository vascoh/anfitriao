import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from './supabase'
import { carregarTudo } from './supabase-tudo'
import { addDays } from './utils'
import { ordenarComQuartos } from './reservations'
import { planearLimpezas, unidadesDoAcesso, type Limpeza, type RegistoLimpeza } from './limpezas'
import type { Booking, Property } from './types'

/**
 * Leitura do plano de limpezas — partilhada pelo ecrã do anfitrião e pelo link
 * da equipa, para que os dois vejam exatamente a mesma lista.
 */

/** Quanto para a frente se procura quem entra a seguir à última limpeza. */
const HORIZONTE_ENTRADA = 120

export interface UnidadeLimpeza {
  id: string
  /** «Casa do Mar · Quarto 2» para quartos, o nome para o resto. */
  nome: string
  morada: string
  cor: string
}

export interface PlanoLimpezas {
  limpezas: Limpeza[]
  unidades: Record<string, UnidadeLimpeza>
}

type PropMin = Pick<Property, 'id' | 'nome' | 'endereco' | 'cidade' | 'cor' | 'parent_id' | 'ativo'>

export async function carregarPlano(ownerId: string, p: {
  de: string
  ate: string
  /** Escolha de um link de equipa; `undefined` = o anfitrião, vê tudo. */
  escolhidas?: string[]
}): Promise<{ plano: PlanoLimpezas; erro?: string }> {
  const supabase = createAdminClient()

  const { data: props, error: erroProps } = await supabase
    .from('properties')
    .select('id, nome, endereco, cidade, cor, parent_id, ativo')
    .eq('owner_id', ownerId)
  if (erroProps) return { plano: { limpezas: [], unidades: {} }, erro: erroProps.message }

  const todas = ordenarComQuartos((props ?? []) as Property[]) as PropMin[]
  const permitidas = unidadesDoAcesso(p.escolhidas ?? [], todas)
  const visiveis = todas.filter(x => permitidas.has(x.id))
  const porId = new Map(todas.map(x => [x.id, x]))

  const { linhas: reservas, erro } = await carregarTudo<Pick<Booking, 'id' | 'propriedade_id' | 'check_in' | 'check_out' | 'estado' | 'num_hospedes' | 'hospede_id' | 'uid_externo' | 'notas' | 'origem'>>(() =>
    supabase
      .from('bookings')
      .select('id, propriedade_id, check_in, check_out, estado, num_hospedes, hospede_id, uid_externo, notas, origem')
      .eq('owner_id', ownerId)
      .gte('check_out', p.de)
      .lte('check_in', addDays(p.ate, HORIZONTE_ENTRADA))
      .order('check_in', { ascending: true })
      .order('id', { ascending: true }))
  if (erro) return { plano: { limpezas: [], unidades: {} }, erro }

  const { data: registos, error: erroReg } = await supabase
    .from('limpezas')
    .select('propriedade_id, data, estado, nota, por, atualizado_em')
    .eq('owner_id', ownerId)
    .gte('data', p.de)
    .lte('data', p.ate)
  if (erroReg) return { plano: { limpezas: [], unidades: {} }, erro: erroReg.message }

  const limpezas = planearLimpezas({
    reservas,
    de: p.de,
    ate: p.ate,
    registos: (registos ?? []) as RegistoLimpeza[],
    ordemUnidades: visiveis.map(x => x.id),
  })

  const unidades: Record<string, UnidadeLimpeza> = {}
  for (const l of limpezas) {
    if (unidades[l.propriedade_id]) continue
    const u = porId.get(l.propriedade_id)
    if (!u) continue
    const casa = u.parent_id ? porId.get(u.parent_id) : undefined
    const morada = [u.endereco?.trim() || casa?.endereco?.trim(), u.cidade?.trim() || casa?.cidade?.trim()]
      .filter(Boolean).join(', ')
    unidades[u.id] = {
      id: u.id,
      nome: casa ? `${casa.nome} · ${u.nome}` : u.nome,
      morada,
      cor: u.cor,
    }
  }

  return { plano: { limpezas, unidades } }
}

/** Grava (ou desfaz, com `por_fazer`) uma marcação. Assume dono já verificado. */
export async function gravarMarcacao(ownerId: string, m: {
  propriedade_id: string; data: string; estado: 'por_fazer' | 'feita' | 'problema'; nota: string | null; por: string
}): Promise<string | null> {
  const supabase = createAdminClient()
  if (m.estado === 'por_fazer') {
    const { error } = await supabase.from('limpezas').delete()
      .eq('owner_id', ownerId).eq('propriedade_id', m.propriedade_id).eq('data', m.data)
    return error?.message ?? null
  }
  const { error } = await supabase.from('limpezas').upsert({
    owner_id: ownerId,
    propriedade_id: m.propriedade_id,
    data: m.data,
    estado: m.estado,
    nota: m.nota,
    por: m.por.slice(0, 60),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'propriedade_id,data' })
  return error?.message ?? null
}

// ─── Links da equipa ──────────────────────────────────────────────────────

export function novoToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(`anfitriao-limpeza:${token}`).digest('hex')
}

export interface AcessoEquipa {
  id: string
  owner_id: string
  nome: string
  propriedade_ids: string[]
}

/** O link existe e não foi revogado? Formato errado nem chega à base. */
export async function resolverAcesso(token: string): Promise<AcessoEquipa | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('limpeza_acessos')
    .select('id, owner_id, nome, propriedade_ids')
    .eq('token_hash', hashToken(token))
    .is('revogado_em', null)
    .maybeSingle()
  return (data as AcessoEquipa | null) ?? null
}

/** Janela que a equipa vê: ontem (para marcar o que ficou) até daqui a 3 semanas. */
export function janelaEquipa(hoje: string): { de: string; ate: string } {
  return { de: addDays(hoje, -2), ate: addDays(hoje, 21) }
}
