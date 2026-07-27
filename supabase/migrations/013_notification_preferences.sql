-- Preferências de notificação por anfitrião.
-- Controla os canais (push/email) para eventos que já disparam notificações
-- ao anfitrião hoje. Não inclui eventos que a app ainda não gera (ver
-- docs/SAAS_ARCHITECTURE.md §9) — evita colunas mortas sem trigger real.
-- Mesmo padrão de push_subscriptions: só service_role acede (RLS sem políticas).

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  owner_id                text PRIMARY KEY,
  nova_reserva_email      boolean NOT NULL DEFAULT true,
  nova_reserva_push       boolean NOT NULL DEFAULT true,
  criado_em               timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.notification_preferences_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_preferences_atualizado_em ON public.notification_preferences;
CREATE TRIGGER notification_preferences_atualizado_em
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notification_preferences_set_atualizado_em();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
-- Sem políticas: anon/authenticated bloqueados, só service_role (API routes) acede.
