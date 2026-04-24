-- =============================================================================
-- 20260424000004_simplify_locations.sql
-- GEI
-- Simplify location structure by removing templates and references.
-- =============================================================================

BEGIN;

-- 1. Drop the location system layers that are being removed.
-- location_references and location_template_nodes have foreign keys to the other tables,
-- so we drop them in order or use CASCADE.
DROP TABLE IF EXISTS location_references CASCADE;
DROP TABLE IF EXISTS location_template_nodes CASCADE;
DROP TABLE IF EXISTS location_templates CASCADE;

-- 2. Drop the resolve_location function as it's no longer needed.
DROP FUNCTION IF EXISTS resolve_location(UUID, TEXT);

-- 3. Modify location_units table: remove template_id.
ALTER TABLE location_units DROP COLUMN IF EXISTS template_id;
ALTER TABLE location_units DROP COLUMN IF EXISTS position;

-- 4. Update issues table: replace location_ref_id with location_unit_id.
-- First, drop the old constraint that depends on location_ref_id.
ALTER TABLE issues DROP CONSTRAINT IF EXISTS chk_issue_destination;

-- Remove the old column and add the new one.
ALTER TABLE issues DROP COLUMN IF EXISTS location_ref_id;
ALTER TABLE issues ADD COLUMN location_unit_id UUID REFERENCES location_units(id);

-- Add the updated constraint.
ALTER TABLE issues ADD CONSTRAINT chk_issue_destination CHECK (
  (
    dest_site_id IS NULL
    AND (location_unit_id IS NOT NULL OR party_id IS NOT NULL)
  )
  OR
  (
    dest_site_id IS NOT NULL
    AND location_unit_id IS NULL
    AND party_id IS NULL
  )
);

-- 5. Update indexes on issues.
DROP INDEX IF EXISTS idx_issues_location;
CREATE INDEX idx_issues_location_unit ON issues(location_unit_id);

COMMIT;
