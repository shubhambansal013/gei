BEGIN;
SELECT plan(6);

-- Load helpers
\ir helpers/auth.sql

-- Setup test users
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000004', 'viewer@test.local', 'VIEWER');
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000005', 'se@test.local', 'SITE_ENGINEER');

-- 1. VIEWER cannot promote themselves to SUPER_ADMIN
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ UPDATE profiles SET role_id = 'SUPER_ADMIN' WHERE id = '00000000-0000-0000-0000-000000000004' $$,
  '42501',
  'Privileged profile columns can only be changed by an administrator.',
  'VIEWER cannot promote themselves (trigger blocks)'
);

-- 2. SITE_ENGINEER cannot promote themselves to ADMIN
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000005');
SELECT throws_ok(
  $$ UPDATE profiles SET role_id = 'ADMIN' WHERE id = '00000000-0000-0000-0000-000000000005' $$,
  '42501',
  'Privileged profile columns can only be changed by an administrator.',
  'SITE_ENGINEER cannot promote themselves (trigger blocks)'
);

-- 3. VIEWER cannot flip is_active on their own row
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$ UPDATE profiles SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000004' $$,
  '42501',
  'Privileged profile columns can only be changed by an administrator.',
  'VIEWER cannot flip is_active (trigger blocks)'
);

-- 4. VIEWER CAN still update their own full_name
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000004');
SELECT lives_ok(
  $$ UPDATE profiles SET full_name = 'Test User' WHERE id = '00000000-0000-0000-0000-000000000004' $$,
  'VIEWER can update their own full_name'
);

-- 5. SUPER_ADMIN can change another user’s role_id
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ UPDATE profiles SET role_id = 'ADMIN' WHERE id = '00000000-0000-0000-0000-000000000004' $$,
  'SUPER_ADMIN can change another user role'
);

-- 6. Signup approval: new signup defaults to is_active=false
-- Mocking new signup by inserting directly into auth.users (if trigger exists it should create profile)
SELECT tests.clear_authentication();
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000007', 'new@test.local');
SELECT results_eq(
  'SELECT is_active FROM profiles WHERE id = ''00000000-0000-0000-0000-000000000007''',
  ARRAY[false],
  'New signup defaults to is_active=false'
);

SELECT * FROM finish();
ROLLBACK;
