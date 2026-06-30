-- 009_rls_drop_authenticated_full.sql
-- Aplicada em produção 2026-06-30 (migration `drop_authenticated_full_blanket_rls_policies`).
--
-- Remove as policies `authenticated_full_*` (ALL, role `authenticated`, USING(true) WITH CHECK(true))
-- que anulavam o isolamento owner-scoped via requesting_owner_id() (ver 008). Como o RLS é
-- permissivo (OR), estas blanket policies davam a qualquer utilizador autenticado acesso total
-- aos dados de todos os anfitriões (incl. `accounts` = faturação).
--
-- Verificado no código que nenhuma leitura autenticada client-side dependia destas policies:
-- o client anon (lib/db.ts) só serve as páginas públicas /book (role anon); todo o acesso
-- autenticado passa por API routes (createAdminClient -> service_role, bypassa RLS) ou pelo
-- user-client owner-scoped (getSupabaseForRequest). Mantêm-se as owner-scoped + as públicas anon.

DROP POLICY IF EXISTS accounts_authenticated_full ON public.accounts;
DROP POLICY IF EXISTS authenticated_full_bookings ON public.bookings;
DROP POLICY IF EXISTS authenticated_full_guests ON public.guests;
DROP POLICY IF EXISTS authenticated_full_platform_rates ON public.platform_rates;
DROP POLICY IF EXISTS authenticated_full_price_change_log ON public.price_change_log;
DROP POLICY IF EXISTS authenticated_full_price_rules ON public.price_rules;
DROP POLICY IF EXISTS authenticated_full_properties ON public.properties;
DROP POLICY IF EXISTS authenticated_full_tarifas ON public.tarifas;
DROP POLICY IF EXISTS authenticated_full_website_settings ON public.website_settings;
