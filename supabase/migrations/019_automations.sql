-- Fase 3: motor de automações — regras trigger → ação, geridas pelo anfitrião.
-- MVP: 2 triggers baseados em data (checkin amanhã / checkout hoje), 1 ação
-- (email ao hóspede). Motor genérico o suficiente para crescer sem redesenho:
-- novos triggers/ações só acrescentam valores aos enums + um branch no cron.

DO $$ BEGIN
  CREATE TYPE automation_trigger AS ENUM ('checkin_amanha', 'checkout_hoje');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE automation_action AS ENUM ('email_hospede');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.automations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       text NOT NULL,
  nome           text NOT NULL,
  trigger_tipo   automation_trigger NOT NULL,
  action_tipo    automation_action NOT NULL DEFAULT 'email_hospede',
  assunto        text NOT NULL DEFAULT '',
  -- Suporta {nome}, {propriedade}, {checkin}, {checkout}, {anfitriao}
  mensagem       text NOT NULL DEFAULT '',
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_owner_idx ON public.automations (owner_id);
CREATE INDEX IF NOT EXISTS automations_trigger_ativo_idx ON public.automations (trigger_tipo) WHERE ativo = true;

CREATE TABLE IF NOT EXISTS public.automation_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  booking_id     text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  executado_em   timestamptz NOT NULL DEFAULT now(),
  resultado      text NOT NULL DEFAULT 'enviado',
  -- Evita reenvio da mesma automação para a mesma reserva (idempotência do cron)
  UNIQUE (automation_id, booking_id)
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_log ENABLE ROW LEVEL SECURITY;
-- Sem políticas anon/authenticated: só service_role (API routes + cron) acede,
-- mesmo padrão de expenses/accounts/push_subscriptions.
