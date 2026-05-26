-- ============================================================================
-- Migration 005: Rooms support (parent_id on properties)
-- ============================================================================
-- Adds parent_id to properties so a single AL can have multiple bookable rooms.
-- Rooms are properties with parent_id set; top-level properties have parent_id = NULL.
-- All existing code continues to work unchanged.
-- ============================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES properties(id) ON DELETE SET NULL;

-- Fast lookup: "give me all rooms of property X"
CREATE INDEX IF NOT EXISTS idx_properties_parent_id ON properties(parent_id);

-- Update RLS policy: anon can read active rooms too (same rule as properties)
-- The existing "public_read_active_properties" policy covers all rows including rooms.
-- No extra policy needed.
