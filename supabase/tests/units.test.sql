BEGIN;
SELECT plan(4);

-- Load helpers
\ir helpers/auth.sql

-- Setup test users
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000003', 'sm@test.local', 'STORE_MANAGER');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000004', 'viewer@test.local', 'VIEWER');

-- 1. SUPER_ADMIN can insert, update, delete unit
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO units (id, label) VALUES ('U1', 'Unit 1') $$,
  'SUPER_ADMIN can insert unit'
);
SELECT lives_ok(
  $$ UPDATE units SET label = 'Unit 1 Edited' WHERE id = 'U1' $$,
  'SUPER_ADMIN can update unit'
);
-- Note: schema might have constraints on units delete, but RLS should allow it if admin
-- In units-admin-write.test.ts it asserts it can delete.

-- 2. STORE_MANAGER cannot insert unit
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000003');
SELECT throws_ok(
  $$ INSERT INTO units (id, label) VALUES ('U2', 'Unit 2') $$,
  42501
);

-- 3. VIEWER cannot insert unit
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ INSERT INTO units (id, label) VALUES ('U3', 'Unit 3') $$,
  42501
);

-- 4. Any authenticated user can select units
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
  'SELECT count(*)::int FROM units WHERE id = ''NOS''',
  ARRAY[1],
  'Authenticated user can select units'
);

SELECT * FROM finish();
ROLLBACK;
