import 'server-only'
import { createAdminClient } from './supabase'

/**
 * Regista uma ação sensível/irreversível. Nunca lança — auditoria não pode
 * bloquear o fluxo principal (mesmo princípio de sendPushToOwner).
 * Não instrumentar tudo: só ações de negócio sensíveis (billing, permissões,
 * exclusões) — ver docs/SAAS_ARCHITECTURE.md §10.
 */
export async function logAudit(p: {
  /** Clerk userId de quem fez a ação; null = sistema (ex: webhook Stripe) */
  actorId: string | null
  entidade: string
  entidadeId: string
  acao: string
  detalhes?: Record<string, unknown>
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('audit_log').insert({
    actor_id: p.actorId,
    entidade: p.entidade,
    entidade_id: p.entidadeId,
    acao: p.acao,
    detalhes: p.detalhes ?? {},
  })
  if (error) console.error('[logAudit]', error.message)
}
