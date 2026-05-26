-- ============================================================================
-- Migration 006: Multi-tenancy foundation
-- Adds owner_id to all tables + slug to website_settings
-- Populates existing data with Vasco's Clerk userId
-- ============================================================================

-- 1. Add owner_id to all tables
ALTER TABLE properties        ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE guests             ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE bookings           ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE price_rules        ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE tarifas             ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE platform_rates     ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE price_change_log   ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE website_settings   ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- 2. Add slug to website_settings (unique booking site URL per host)
ALTER TABLE website_settings ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 3. Populate all existing rows with Vasco's userId
UPDATE properties        SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE guests             SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE bookings           SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE price_rules        SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE tarifas             SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE platform_rates     SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE price_change_log   SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6';
UPDATE website_settings   SET owner_id = 'user_3DrUZjHebFBKAawGzhOfGzwwel6', slug = 'casadevasco';

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_properties_owner      ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_guests_owner          ON guests(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner        ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_owner     ON price_rules(owner_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_owner         ON tarifas(owner_id);
CREATE INDEX IF NOT EXISTS idx_platform_rates_owner  ON platform_rates(owner_id);
CREATE INDEX IF NOT EXISTS idx_website_settings_slug ON website_settings(slug);
