-- Standard roles and actions are expected to be seeded by migrations (20260420000004_masters_rls.sql, etc.)
-- This seed file provides sample data for development and E2E testing.

BEGIN;

-- 1. Create a primary test site
INSERT INTO sites (code, name)
VALUES ('S-MAIN', 'Main Site Office')
ON CONFLICT (code) DO NOTHING;

-- 2. Create sample items
INSERT INTO items (code, name, stock_unit) VALUES
  ('I-CEMENT', 'Cement 50kg', 'BAG'),
  ('I-SAND',   'River Sand',   'CUM'),
  ('I-REBAR',  'Rebar 12mm',   'MT')
ON CONFLICT (code) DO NOTHING;

-- 3. Create a test supplier
INSERT INTO parties (name, type, short_code)
VALUES ('Apex Construction Supplies', 'SUPPLIER', 'APEX')
ON CONFLICT (short_code) DO NOTHING;

-- 4. Create a test worker
-- Note: code will be auto-minted by trigger.
-- Using subquery to avoid conflict issues since no natural key is provided.
INSERT INTO workers (full_name, current_site_id)
SELECT 'Dev Engineer', id FROM sites WHERE code = 'S-MAIN'
AND NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Dev Engineer');

COMMIT;
