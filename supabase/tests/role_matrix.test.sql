BEGIN;
SELECT plan(10);

-- Load helpers
\ir helpers/auth.sql

-- Setup test data
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000002', 'admin@test.local', 'ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000003', 'sm@test.local', 'STORE_MANAGER');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000004', 'viewer@test.local', 'VIEWER');

INSERT INTO sites (id, code, name) VALUES ('00000000-0000-0000-0000-000000000100', 'S1', 'Site 1');

-- 1. SUPER_ADMIN can insert item
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO items (code, name, stock_unit) VALUES ('I1', 'Item 1', 'NOS') $$,
  'SUPER_ADMIN can insert item'
);

-- 2. VIEWER cannot insert item
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ INSERT INTO items (code, name, stock_unit) VALUES ('I2', 'Item 2', 'NOS') $$,
  42501
);

-- 3. STORE_MANAGER cannot insert item (global role only)
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000003');
SELECT throws_ok(
  $$ INSERT INTO items (code, name, stock_unit) VALUES ('I3', 'Item 3', 'NOS') $$,
  42501
);

-- 4. ADMIN on a site can insert item (is_admin_anywhere returns true)
SELECT tests.clear_authentication();
INSERT INTO site_user_access (user_id, site_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000100', 'ADMIN');

SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT lives_ok(
  $$ INSERT INTO items (code, name, stock_unit) VALUES ('I4', 'Item 4', 'NOS') $$,
  'Site ADMIN can insert item'
);

-- 5. Transactions: STORE_MANAGER can insert purchase for their site
-- First we need an item
SELECT tests.clear_authentication();
INSERT INTO items (id, code, name, stock_unit) VALUES ('00000000-0000-0000-0000-000000000500', 'I5', 'Item 5', 'NOS');
INSERT INTO site_user_access (user_id, site_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000100', 'STORE_MANAGER');

SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000003');
SELECT lives_ok(
  $$ INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
     VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000500', 10, 'NOS', 1, 'NOS') $$,
  'STORE_MANAGER can insert purchase'
);

-- 6. SITE_ENGINEER cannot insert purchase
SELECT tests.clear_authentication();
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000005', 'se@test.local', 'VIEWER');
INSERT INTO site_user_access (user_id, site_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000100', 'SITE_ENGINEER');

SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000005');
SELECT throws_ok(
  $$ INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
     VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000500', 1, 'NOS', 1, 'NOS') $$,
  42501
);

-- 7. Any authenticated user can SELECT items
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000005');
SELECT results_eq(
  'SELECT count(*)::int FROM items WHERE code = ''I1''',
  ARRAY[1],
  'Authenticated user can select items'
);

-- 8. Sites visibility: VIEWER only sees sites they have access to
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000005');
SELECT results_eq(
  'SELECT count(*)::int FROM sites',
  ARRAY[1],
  'VIEWER sees 1 site they have access to'
);

-- 9. SUPER_ADMIN sees all sites
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT results_eq(
  'SELECT count(*)::int FROM sites',
  ARRAY[1],
  'SUPER_ADMIN sees all sites'
);

-- 10. VIEWER with no access sees 0 sites
SELECT tests.clear_authentication();
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000006', 'none@test.local', 'VIEWER');
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000006');
SELECT results_eq(
  'SELECT count(*)::int FROM sites',
  ARRAY[0],
  'VIEWER with no access sees 0 sites'
);

SELECT * FROM finish();
ROLLBACK;
