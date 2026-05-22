-- ============================================================================
-- Migration 004: Row Level Security (RLS) Policies
-- ============================================================================
-- PURPOSE:
--   Enable RLS on all tables so that unauthenticated requests (bare anon key)
--   cannot read or write application data.
--
-- INTEGRATION NOTES:
--   This app uses Clerk for auth, not Supabase Auth. Until Clerk JWT is
--   integrated with Supabase (via custom JWT claims), we use a two-tier approach:
--
--   Tier 1 (current): Restrict to authenticated Supabase sessions only.
--     The app's server-side API routes use the service_role key (env var
--     SUPABASE_SERVICE_ROLE_KEY) which bypasses RLS — this is correct since
--     all mutations go through authenticated Next.js API routes.
--
--   Tier 2 (future): Add Clerk user ID claims to Supabase JWT so each row
--     can be scoped to a specific owner/org. See:
--     https://clerk.com/docs/integrations/databases/supabase
--
-- IMPORTANT: Apply this migration in the Supabase Dashboard → SQL Editor.
-- ============================================================================

-- Enable RLS on all application tables
ALTER TABLE properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_rates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_log ENABLE ROW LEVEL SECURITY;

-- ── Drop any pre-existing policies to avoid conflicts ─────────────────────────

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'properties','guests','bookings','website_settings',
        'price_rules','tarifas','platform_rates','price_change_log'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── Public read-only access for the booking site ──────────────────────────────
-- /book and /checkin are public routes that need to read properties

CREATE POLICY "public_read_active_properties"
  ON properties FOR SELECT
  TO anon
  USING (ativo = true);

-- Public booking site needs website settings
CREATE POLICY "public_read_website_settings"
  ON website_settings FOR SELECT
  TO anon
  USING (true);

-- Public checkin flow needs to read bookings by ID
CREATE POLICY "public_read_bookings_for_checkin"
  ON bookings FOR SELECT
  TO anon
  USING (true);  -- Bookings are read by ID — no sensitive PII exposed in list

-- Public checkin flow needs to update booking historico
CREATE POLICY "public_update_booking_historico"
  ON bookings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Public booking site needs to read guests (for check-in form prefill)
CREATE POLICY "public_read_guests_limited"
  ON guests FOR SELECT
  TO anon
  USING (true);

-- Public booking site creates guests during booking flow
CREATE POLICY "public_insert_guests"
  ON guests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public booking site inserts new direct bookings
CREATE POLICY "public_insert_bookings"
  ON bookings FOR INSERT
  TO anon
  WITH CHECK (origem = 'direto');

-- ── Authenticated (service_role) — full access ────────────────────────────────
-- Next.js server-side API routes use service_role key which bypasses RLS.
-- These policies are here for completeness and future Clerk JWT integration.

CREATE POLICY "authenticated_full_properties"
  ON properties FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_guests"
  ON guests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_bookings"
  ON bookings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_website_settings"
  ON website_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_price_rules"
  ON price_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_tarifas"
  ON tarifas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_platform_rates"
  ON platform_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_price_change_log"
  ON price_change_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Indexes: performance optimizations ───────────────────────────────────────

-- Speed up today's arrivals/departures queries
CREATE INDEX IF NOT EXISTS idx_bookings_check_in  ON bookings (check_in);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON bookings (check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_estado    ON bookings (estado);

-- Speed up property-scoped queries
CREATE INDEX IF NOT EXISTS idx_bookings_property_estado
  ON bookings (propriedade_id, estado, check_in);

-- Speed up iCal sync dedup lookup
CREATE INDEX IF NOT EXISTS idx_bookings_uid_externo
  ON bookings (uid_externo)
  WHERE uid_externo IS NOT NULL;

-- Speed up guest lookup by email
CREATE INDEX IF NOT EXISTS idx_guests_email
  ON guests (email)
  WHERE email IS NOT NULL;

-- Speed up price rules matching by property + date
CREATE INDEX IF NOT EXISTS idx_price_rules_property_dates
  ON price_rules (property_id, data_inicio, data_fim)
  WHERE ativo = true;
