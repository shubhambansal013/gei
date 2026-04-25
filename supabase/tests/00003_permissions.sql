BEGIN;
SELECT plan(4);

-- 1. Setup: Site and User
INSERT INTO sites (code, name) VALUES ('T-PERM', 'Permission Test Site');
INSERT INTO profiles (id, email, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-user@gei.local', 'VIEWER', true);

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
INSERT INTO profiles (id, email, role_id, is_active)
VALUES ('00000000-0000-0000-0000-000000000002', 'super@gei.local', 'SUPER_ADMIN', true);

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE code = 'T-PERM'), 'MASTERS', 'DELETE'),
    true,
    'SUPER_ADMIN should have global permission for MASTERS.DELETE'
);

-- 5. Test inactive user
UPDATE profiles SET is_active = false WHERE email = 'super@gei.local';

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE code = 'T-PERM'), 'MASTERS', 'DELETE'),
    false,
    'Inactive user should have no permissions regardless of role'
);

SELECT * FROM finish();
ROLLBACK;
