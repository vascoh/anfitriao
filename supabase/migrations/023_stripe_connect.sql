-- Pagamentos de hóspedes via Stripe Connect (charges diretas — o dinheiro e a
-- responsabilidade de disputa ficam sempre na conta Stripe do anfitrião,
-- nunca na conta da plataforma). Ver docs/SAAS_ARCHITECTURE.md (a atualizar)
-- e CHANGELOG correspondente para a justificação da arquitetura.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_stripe_connect_account_id_idx
  ON public.accounts (stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;

-- Liga uma reserva à sessão de checkout que a pagou — chave de idempotência
-- para o preenchimento da reserva (webhook + fallback síncrono na página de
-- confirmação podem tentar preencher a mesma sessão duas vezes).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_checkout_session_id_idx
  ON public.bookings (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
