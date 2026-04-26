BEGIN;
SELECT plan(3);

-- Setup: Mock auth.users for FK dependency
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    raw_user_meta_data JSONB
);

-- Setup: Create a regular user
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'reg@gei.local');
INSERT INTO profiles (id, full_name, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Regular User', 'VIEWER', true);

-- Mock auth.uid() and auth.role()
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ SELECT '00000000-0000-0000-0000-000000000001'::UUID $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$ SELECT 'authenticated' $$;

-- 1. Test Self-Promotion Blocked
SELECT throws_ok(
    'UPDATE profiles SET role_id = ''SUPER_ADMIN'' WHERE id = ''00000000-0000-0000-0000-000000000001''',
    'Privileged profile columns can only be changed by an administrator.',
    'Should block non-admin from changing their own role'
);

-- 2. Test Deactivation Blocked
SELECT throws_ok(
    'UPDATE profiles SET is_active = false WHERE id = ''00000000-0000-0000-0000-000000000001''',
    'Privileged profile columns can only be changed by an administrator.',
    'Should block non-admin from deactivating their own profile'
);

-- 3. Test Cross-User Update Blocked
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'other@gei.local');
INSERT INTO profiles (id, full_name, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000002', 'Other User', 'VIEWER', true);

SELECT throws_ok(
    'UPDATE profiles SET full_name = ''Hacked'' WHERE id = ''00000000-0000-0000-0000-000000000002''',
    'Non-admin users may only update their own profile.',
    'Should block non-admin from updating another users profile'
);

SELECT * FROM finish();
ROLLBACK;
