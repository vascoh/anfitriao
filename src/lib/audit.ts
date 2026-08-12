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

/** Como os dados de documento saíram do sistema. */
export type ViaDeAcesso =
  /** CSV do SIBA descarregado em `/documentos` */
  | 'export_csv_siba'
  /** Boletins entregues ao SIBA por web service */
  | 'submissao_siba'
  /** Ficheiro de dados do titular, art. 15.º/20.º do RGPD */
  | 'export_rgpd'

/**
 * Regista um acesso a dados de documento de identificação (ANF-1.8).
 *
 * Só regista o que **sai** do sistema — ficheiros descarregados e submissões a
 * terceiros. Ver a ficha de um hóspede na app não fica registado de propósito:
 * é o trabalho normal de quem gere alojamentos, e um log que cresce a cada
 * página aberta deixa de se conseguir ler quando é preciso. O que se quer
 * poder responder mais tarde é "quem levou estes dados daqui para fora, e
 * quando" — não "quem olhou".
 *
 * Nunca lança, pela mesma razão que `logAudit`: a auditoria não pode impedir
 * o anfitrião de cumprir uma obrigação legal.
 */
export async function logAcessoSensivel(p: {
  actorId: string | null
  via: ViaDeAcesso
  /** Quantas pessoas ficaram expostas nesta operação */
  pessoas: number
  /** Contexto útil: período do export, reserva submetida, id do hóspede */
  detalhes?: Record<string, unknown>
}): Promise<void> {
  await logAudit({
    actorId: p.actorId,
    entidade: 'guests',
    entidadeId: String(p.detalhes?.guest_id ?? p.via),
    acao: 'acesso_dados_documento',
    detalhes: { via: p.via, pessoas: p.pessoas, ...p.detalhes },
  })
}
