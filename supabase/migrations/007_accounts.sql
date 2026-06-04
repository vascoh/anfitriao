-- ============================================================================
-- Migration 007: Accounts table (billing & subscription management)
-- ============================================================================
-- This table is required by src/lib/accounts.ts and is used on every
-- authenticated page load via ensureAccount().
-- Without it, all new user sessions fail with a 400/500 error.
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE account_plano AS ENUM ('trial', 'starter', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_estado AS ENUM ('trial', 'activo', 'suspenso', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id           TEXT NOT NULL UNIQUE,
  email                   TEXT NOT NULL,
  nome                    TEXT,
  plano                   account_plano NOT NULL DEFAULT 'trial',
  estado                  account_estado NOT NULL DEFAULT 'trial',
  trial_ends_at           TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  propriedades_max        INTEGER NOT NULL DEFAULT 1,
  notas_admin             TEXT,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_price_id         TEXT,
  current_period_end      TIMESTAMPTZ,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_clerk_user_id    ON public.accounts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_estado           ON public.accounts(estado);
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer  ON public.accounts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Auto-update atualizado_em
CREATE OR REPLACE FUNCTION public.accounts_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_atualizado_em ON public.accounts;
CREATE TRIGGER accounts_atualizado_em
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounts_set_atualizado_em();

-- RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Service role (used by all Next.js server routes) bypasses RLS automatically.
-- Admin panel reads all accounts via service_role — intentionally.
-- No anon access.
CREATE POLICY "accounts_authenticated_full"
  ON public.accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed Vasco's account if not already present
INSERT INTO public.accounts (clerk_user_id, email, nome, plano, estado, propriedades_max)
VALUES ('user_3DrUZjHebFBKAawGzhOfGzwwel6', 'vascotelo@gmail.com', 'Vasco Henriques', 'trial', 'trial', 3)
ON CONFLICT (clerk_user_id) DO NOTHING;
