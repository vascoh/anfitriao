-- ============================================================================
-- Migration 008: Row Level Security — isolamento por owner_id
--
-- IMPORTANTE: Antes de aplicar, configurar o Clerk JWT template no Supabase:
--   Dashboard → Authentication → JWT Templates → Add template → Supabase
--   Cole o template JWT do Clerk que inclui o user_id como "sub"
--
-- O anon client (browser) usa o JWT do Clerk para identificar o utilizador.
-- A claim "sub" no JWT contém o Clerk userId (owner_id nas tabelas).
--
-- Aplica via Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── Helper function ──────────────────────────────────────────────────────────
-- Extrai o Clerk userId do JWT do utilizador autenticado.
-- Retorna NULL se não houver JWT válido.
CREATE OR REPLACE FUNCTION public.requesting_owner_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'sub',
      ''
    ),
    ''
  )
$$;

-- ── properties ───────────────────────────────────────────────────────────────
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_owner_select" ON public.properties;
DROP POLICY IF EXISTS "properties_owner_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_owner_update" ON public.properties;
DROP POLICY IF EXISTS "properties_owner_delete" ON public.properties;
DROP POLICY IF EXISTS "properties_public_read"  ON public.properties;

-- Public read for active properties (booking site — anon access)
CREATE POLICY "properties_public_read" ON public.properties
  FOR SELECT TO anon
  USING (ativo = true AND owner_id IS NOT NULL);

-- Authenticated users see and manage only their own data
CREATE POLICY "properties_owner_select" ON public.properties
  FOR SELECT TO authenticated
  USING (owner_id = requesting_owner_id());

CREATE POLICY "properties_owner_insert" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "properties_owner_update" ON public.properties
  FOR UPDATE TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "properties_owner_delete" ON public.properties
  FOR DELETE TO authenticated
  USING (owner_id = requesting_owner_id());

-- ── guests ────────────────────────────────────────────────────────────────────
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guests_owner_select" ON public.guests;
DROP POLICY IF EXISTS "guests_owner_insert" ON public.guests;
DROP POLICY IF EXISTS "guests_owner_update" ON public.guests;
DROP POLICY IF EXISTS "guests_owner_delete" ON public.guests;

CREATE POLICY "guests_owner_select" ON public.guests
  FOR SELECT TO authenticated
  USING (owner_id = requesting_owner_id());

CREATE POLICY "guests_owner_insert" ON public.guests
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "guests_owner_update" ON public.guests
  FOR UPDATE TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "guests_owner_delete" ON public.guests
  FOR DELETE TO authenticated
  USING (owner_id = requesting_owner_id());

-- Allow anon insert for check-in online (guests submit their own data)
CREATE POLICY "guests_checkin_insert" ON public.guests
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon update for check-in online
CREATE POLICY "guests_checkin_update" ON public.guests
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- ── bookings ──────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_owner_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_owner_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_owner_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_owner_delete" ON public.bookings;
DROP POLICY IF EXISTS "bookings_public_read"  ON public.bookings;

-- Public read for availability checks (booking site needs to see blocked dates)
CREATE POLICY "bookings_public_read" ON public.bookings
  FOR SELECT TO anon
  USING (estado NOT IN ('cancelada', 'no_show'));

-- Anon insert for direct bookings from public site
CREATE POLICY "bookings_public_insert" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "bookings_owner_select" ON public.bookings
  FOR SELECT TO authenticated
  USING (owner_id = requesting_owner_id());

CREATE POLICY "bookings_owner_insert" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "bookings_owner_update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

CREATE POLICY "bookings_owner_delete" ON public.bookings
  FOR DELETE TO authenticated
  USING (owner_id = requesting_owner_id());

-- ── website_settings ──────────────────────────────────────────────────────────
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_settings_public_read" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_owner_select" ON public.website_settings;
DROP POLICY IF EXISTS "website_settings_owner_upsert" ON public.website_settings;

-- Public read for booking site (r/[slug] page needs settings)
CREATE POLICY "website_settings_public_read" ON public.website_settings
  FOR SELECT TO anon
  USING (enabled = true);

CREATE POLICY "website_settings_owner_select" ON public.website_settings
  FOR SELECT TO authenticated
  USING (owner_id = requesting_owner_id() OR id = 1);

CREATE POLICY "website_settings_owner_upsert" ON public.website_settings
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id() OR id = 1)
  WITH CHECK (owner_id = requesting_owner_id() OR id = 1);

-- ── price_rules ───────────────────────────────────────────────────────────────
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_rules_owner" ON public.price_rules;

CREATE POLICY "price_rules_owner" ON public.price_rules
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

-- ── tarifas ───────────────────────────────────────────────────────────────────
ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarifas_owner" ON public.tarifas;

CREATE POLICY "tarifas_owner" ON public.tarifas
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

-- ── platform_rates ────────────────────────────────────────────────────────────
ALTER TABLE public.platform_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_rates_owner" ON public.platform_rates;

CREATE POLICY "platform_rates_owner" ON public.platform_rates
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

-- ── price_change_log ──────────────────────────────────────────────────────────
ALTER TABLE public.price_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_change_log_owner" ON public.price_change_log;

CREATE POLICY "price_change_log_owner" ON public.price_change_log
  FOR ALL TO authenticated
  USING (owner_id = requesting_owner_id())
  WITH CHECK (owner_id = requesting_owner_id());

-- ── accounts ──────────────────────────────────────────────────────────────────
-- accounts table já tem RLS definida na migration 007.
-- Não alterar — service_role bypassa e é o que todos os API routes usam.

-- ============================================================================
-- NOTA: Para activar, configurar também o Clerk JWT template no Supabase:
--
-- 1. Clerk Dashboard → Configure → JWT Templates → "New template" → Supabase
-- 2. Supabase Dashboard → Authentication → JWT → copiar o "JWT Secret"
--    ou usar o JWKS URL do Clerk
-- 3. Ao usar o cliente anon com o JWT do Clerk, a função requesting_owner_id()
--    vai ler o "sub" do token e aplicar o filtro automaticamente.
-- ============================================================================
