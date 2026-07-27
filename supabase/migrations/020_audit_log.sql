-- Fase 3: audit log genérico para ações sensíveis/irreversíveis (não para tudo —
-- ver docs/SAAS_ARCHITECTURE.md §10). Primeiro consumidor: mudanças de
-- estado/plano de conta (billing via Stripe webhook + overrides manuais do admin).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clerk userId de quem fez a ação; null = sistema (ex: webhook Stripe)
  actor_id    text,
  entidade    text NOT NULL,
  entidade_id text NOT NULL,
  acao        text NOT NULL,
  detalhes    jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entidade_idx ON public.audit_log (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS audit_log_criado_em_idx ON public.audit_log (criado_em DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só service_role (lib/audit.ts + backoffice admin) acede.
