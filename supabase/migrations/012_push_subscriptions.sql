-- Subscrições Web Push dos anfitriões (uma linha por browser/dispositivo).
-- Escrita/leitura exclusivamente via API routes com service_role — RLS ativo
-- sem políticas bloqueia anon e authenticated (mesmo padrão de accounts).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_owner_idx ON public.push_subscriptions (owner_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
