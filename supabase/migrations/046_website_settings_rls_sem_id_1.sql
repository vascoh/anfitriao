-- 046 — Tirar o `OR (id = 1)` do RLS de website_settings, e limpar índices duplicados
--
-- CROSS-TENANT (encontrado 2026-09-08 na auditoria de produção):
-- As duas policies `authenticated` de website_settings tinham o predicado
--   ((owner_id = requesting_owner_id()) OR (id = 1))
-- O segundo ramo é resíduo do modelo single-tenant, em que id=1 era *a* linha de
-- definições do site. Desde 006_multitenancy_foundation.sql a tabela é por dono,
-- e a linha id=1 passou a pertencer a um anfitrião concreto (em produção, o do
-- `casadevasco`). O `OR (id = 1)` dá a QUALQUER autenticado leitura e escrita
-- sobre as definições do site desse anfitrião — slug, branding, textos.
--
-- A migração 026 corrigiu o mesmo resíduo do lado do DEFAULT da coluna (que fazia
-- toda a conta nova colidir na PK); o predicado do RLS ficou por corrigir.
--
-- Hoje está inerte: o template JWT do Clerk nunca foi ligado, portanto o cliente
-- do browser entra como `anon` e nunca como `authenticated`, e todo o acesso real
-- da app é `service_role` (createAdminClient), que ignora RLS. Fica corrigido
-- antes de ligar o template — que é o passo que o armaria (ver TODO, "Código
-- morto de RLS").
--
-- Também: `website_settings_owner_select` (SELECT) é redundante com
-- `website_settings_owner_upsert` (ALL), que tem o mesmo predicado e já cobre o
-- SELECT. Duas policies permissivas para o mesmo role/ação avaliam-se as duas
-- (WARN `multiple_permissive_policies` do advisor). Fica uma só.

DROP POLICY IF EXISTS website_settings_owner_select ON public.website_settings;
DROP POLICY IF EXISTS website_settings_owner_upsert ON public.website_settings;

CREATE POLICY website_settings_owner_all ON public.website_settings
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

-- Índices duplicados em accounts.clerk_user_id: há três sobre a mesma coluna.
-- `accounts_clerk_user_id_key` é UNIQUE (nasce da constraint) e cobre todas as
-- pesquisas; os outros dois são cópias btree simples, uma delas de nome
-- diferente por ter sido criada duas vezes. Ficam a ocupar espaço e a ser
-- mantidos em cada escrita, sem servirem nenhuma consulta que o UNIQUE não sirva.
DROP INDEX IF EXISTS public.accounts_clerk_user_id_idx;
DROP INDEX IF EXISTS public.idx_accounts_clerk_user_id;

-- Chaves estrangeiras sem índice de cobertura. Sem elas, apagar a linha do lado
-- pai obriga a varrimento sequencial da tabela filha para verificar a FK.
CREATE INDEX IF NOT EXISTS expenses_propriedade_id_idx
  ON public.expenses (propriedade_id);
CREATE INDEX IF NOT EXISTS automation_log_booking_id_idx
  ON public.automation_log (booking_id);
CREATE INDEX IF NOT EXISTS website_settings_template_id_idx
  ON public.website_settings (template_id);
