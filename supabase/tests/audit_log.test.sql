BEGIN;
SELECT plan(3);

-- Load helpers
\ir helpers/auth.sql

-- Setup test users
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000004', 'viewer@test.local', 'VIEWER');

INSERT INTO sites (id, code, name) VALUES ('00000000-0000-0000-0000-000000000200', 'S2', 'Site 2');
INSERT INTO items (id, code, name, stock_unit) VALUES ('00000000-0000-0000-0000-000000000200', 'I2', 'Item 2', 'NOS');

-- 1. Trigger writes before/after JSONB + reason on UPDATE
-- We need a purchase to update
INSERT INTO purchases (id, site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000200', 10, 'NOS', 1, 'NOS');

-- Set the edit reason via GUC
SET "app.edit_reason" = 'Testing audit log';
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');

UPDATE purchases SET received_qty = 15 WHERE id = '00000000-0000-0000-0000-000000000201';

SELECT results_eq(
  $$ SELECT edit_reason FROM inventory_edit_log WHERE row_id = '00000000-0000-0000-0000-000000000201' $$,
  ARRAY['Testing audit log'],
  'Trigger writes reason to audit log'
);

-- 2. VIEWER cannot SELECT edit_log rows for sites they have no access to
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
  'SELECT count(*)::int FROM inventory_edit_log',
  ARRAY[0],
  'VIEWER sees 0 audit log rows without site access'
);

-- 3. VIEWER can see audit log if they have site access
SELECT tests.clear_authentication();
INSERT INTO site_user_access (user_id, site_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000200', 'VIEWER');

SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
  'SELECT count(*)::int FROM inventory_edit_log',
  ARRAY[1],
  'VIEWER sees audit log with site access'
);

SELECT * FROM finish();
ROLLBACK;
