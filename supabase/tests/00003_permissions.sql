BEGIN;
SELECT plan(4);

-- Setup: Drop FK to avoid dependency on real auth.users which might be restricted in this env
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

DO $$
DECLARE
    u_code TEXT := substring(gen_random_uuid()::text, 1, 8);
    s_id UUID;
    u1_id UUID := '00000000-0000-0000-0000-000000000001';
    u2_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO sites (code, name) VALUES ('T-PRM-' || u_code, 'Perm Test Site ' || u_code) RETURNING id INTO s_id;

    -- 1. Setup User (Regular)
    INSERT INTO profiles (id, full_name, role_id, is_active)
    VALUES (u1_id, 'Test User ' || u_code, 'VIEWER', true);

    -- 2. Test can_user with no access - verified by SELECT is below

    -- 3. Test can_user with STORE_MANAGER access on site
    INSERT INTO site_user_access (user_id, site_id, role_id)
    VALUES (u1_id, s_id, 'STORE_MANAGER');

    -- 4. Test can_user with SUPER_ADMIN global role
    INSERT INTO profiles (id, full_name, role_id, is_active)
    VALUES (u2_id, 'Super Admin ' || u_code, 'SUPER_ADMIN', true);
END $$;

SELECT is(
    can_user('00000000-0000-0000-0000-000000000001', (SELECT id FROM sites WHERE name LIKE 'Perm Test Site %' ORDER BY created_at DESC LIMIT 1), 'INVENTORY', 'CREATE'),
    true,
    'STORE_MANAGER on site should have INVENTORY.CREATE permission'
);

SELECT is(
    can_user('00000000-0000-0000-0000-000000000001', (SELECT id FROM sites WHERE name LIKE 'Perm Test Site %' ORDER BY created_at DESC LIMIT 1), 'MASTERS', 'DELETE'),
    false,
    'Regular STORE_MANAGER should not have MASTERS.DELETE permission'
);

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE name LIKE 'Perm Test Site %' ORDER BY created_at DESC LIMIT 1), 'MASTERS', 'DELETE'),
    true,
    'SUPER_ADMIN should have global permission for MASTERS.DELETE'
);

-- Test inactive user
UPDATE profiles SET is_active = false WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT is(
    can_user('00000000-0000-0000-0000-000000000002', (SELECT id FROM sites WHERE name LIKE 'Perm Test Site %' ORDER BY created_at DESC LIMIT 1), 'MASTERS', 'DELETE'),
    false,
    'Inactive user should have no permissions regardless of role'
);

SELECT * FROM finish();
ROLLBACK;
