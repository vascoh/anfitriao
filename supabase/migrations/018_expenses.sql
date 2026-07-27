-- Fase 3: módulo Financeiro — despesas por conta/propriedade.
-- Mesmo padrão de owner_id + RLS de todas as tabelas core.

DO $$ BEGIN
  CREATE TYPE expense_categoria AS ENUM (
    'limpeza', 'manutencao', 'comissoes', 'utilidades', 'marketing', 'iva', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       text,
  propriedade_id text REFERENCES public.properties(id) ON DELETE SET NULL,
  categoria      expense_categoria NOT NULL DEFAULT 'outro',
  descricao      text NOT NULL DEFAULT '',
  valor          numeric NOT NULL DEFAULT 0,
  data           date NOT NULL DEFAULT CURRENT_DATE,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_owner_idx ON public.expenses (owner_id);
CREATE INDEX IF NOT EXISTS expenses_data_idx ON public.expenses (data);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
-- Sem políticas anon/authenticated: só service_role (API routes) acede,
-- mesmo padrão de accounts/push_subscriptions/notification_preferences.
