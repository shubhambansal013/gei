BEGIN;
SELECT plan(6);

-- Load helpers
\ir helpers/auth.sql

-- Setup test users
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000004', 'viewer@test.local', 'VIEWER');

-- 1. Parties: SUPER_ADMIN can insert party
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO parties (name, type) VALUES ('Party 1', 'SUPPLIER') $$,
  'SUPER_ADMIN can insert party'
);

-- 2. Parties: VIEWER cannot insert party
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ INSERT INTO parties (name, type) VALUES ('Party 2', 'SUPPLIER') $$,
  42501
);

-- 3. Parties: Any authenticated user can select
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
  'SELECT count(*)::int FROM parties WHERE name = ''Party 1''',
  ARRAY[1],
  'Authenticated user can select parties'
);

-- 4. Sites: SUPER_ADMIN can insert site
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO sites (code, name) VALUES ('S-TEST', 'Test Site') $$,
  'SUPER_ADMIN can insert site'
);

-- 5. Sites: VIEWER cannot insert site
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ INSERT INTO sites (code, name) VALUES ('S-DENY', 'Deny Site') $$,
  42501
);

-- 6. Hard delete blocked on purchases
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
-- Need an item and site first for purchase
INSERT INTO items (id, code, name, stock_unit) VALUES ('00000000-0000-0000-0000-000000000900', 'I-HARD', 'Hard delete item', 'NOS');
INSERT INTO sites (id, code, name) VALUES ('00000000-0000-0000-0000-000000000900', 'S-HARD', 'Hard delete site');
INSERT INTO purchases (id, site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
VALUES ('00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000900', 1, 'NOS', 1, 'NOS');

SELECT throws_ok(
  $$ DELETE FROM purchases WHERE id = '00000000-0000-0000-0000-000000000900' $$,
  42501,
  NULL,
  'Hard delete on purchases is blocked even for SUPER_ADMIN'
);

SELECT * FROM finish();
ROLLBACK;
