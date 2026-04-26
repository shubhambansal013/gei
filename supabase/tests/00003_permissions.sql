BEGIN;
SELECT plan(4);

-- Setup: Mock auth.users for FK dependency
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    raw_user_meta_data JSONB
);

INSERT INTO sites (code, name) VALUES ('T-PERM', 'Permission Test Site');

-- 1. Setup User
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test@gei.local');
INSERT INTO profiles (id, full_name, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test User', 'VIEWER', true);

-- 2. Test can_user with no access
SELECT is(
    can_user('00000000-0000-0000-0000-000000000001', (SELECT id FROM sites WHERE code = 'T-PERM'), 'INVENTORY', 'CREATE'),
    false,
    'VIEWER should not have INVENTORY.CREATE permission by default'
);

-- 3. Test can_user with STORE_MANAGER access on site
INSERT INTO site_user_access (user_id, site_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000001', (SELECT id FROM sites WHERE code = 'T-PERM'), 'STORE_MANAGER');

SELECT is(
    can_user('00000000-0000-0000-0000-000000000001', (SELECT id FROM sites WHERE code = 'T-PERM'), 'INVENTORY', 'CREATE'),
    true,
    'STORE_MANAGER on site should have INVENTORY.CREATE permission'
);

-- 4. Test can_user with SUPER_ADMIN global role
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'super@gei.local');
INSERT INTO profiles (id, full_name, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000002', 'Super Admin', 'SUPER_ADMIN', true);

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE code = 'T-PERM'), 'MASTERS', 'DELETE'),
    true,
    'SUPER_ADMIN should have global permission for MASTERS.DELETE'
);

-- 5. Test inactive user
UPDATE profiles SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE code = 'T-PERM'), 'MASTERS', 'DELETE'),
    false,
    'Inactive user should have no permissions regardless of role'
);

SELECT * FROM finish();
ROLLBACK;
