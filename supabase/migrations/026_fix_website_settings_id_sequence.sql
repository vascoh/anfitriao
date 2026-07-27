-- BUG CRÍTICO (encontrado 2026-07-27 ao testar onboarding E2E com conta nova):
-- website_settings.id tinha DEFAULT 1 fixo (herança do modelo single-tenant
-- original, nunca migrado para sequência quando a tabela passou a multi-tenant
-- em 006_multitenancy_foundation.sql). Todo o INSERT sem id explícito tentava
-- id=1, colidindo com a PRIMARY KEY da linha existente (id=1, produção real).
-- Na prática: NENHUMA conta nova conseguia gravar o website pela primeira vez
-- (POST /api/website-settings falhava sempre com 23505 no INSERT).
CREATE SEQUENCE IF NOT EXISTS website_settings_id_seq;
SELECT setval('website_settings_id_seq', COALESCE((SELECT MAX(id) FROM public.website_settings), 0) + 1, false);
ALTER TABLE public.website_settings ALTER COLUMN id SET DEFAULT nextval('website_settings_id_seq');
ALTER SEQUENCE website_settings_id_seq OWNED BY public.website_settings.id;
