-- Wave-2 rename + cleanup (Issues #3 + #10).
--
-- 1. Remove the DPR permission module entirely. No DPR feature exists in
--    v1 and none is planned in the current milestone; keeping the seeded
--    rows around creates dead permissions that show up in the overrides
--    grid and leak into ModuleId unions.
-- 2. Rename LABOUR → WORKERS. "Labour" as an English term is ambiguous
--    (labour-force, labour-party, UK spelling) whereas "Workers" matches
--    the Hindi mental model site engineers already use in conversation.
-- 3. Keep INVENTORY / LOCATION / REPORTS as-is. Inward / Outward are UI
--    labels nested under INVENTORY, not their own modules, so no DB
--    rename is required there.
--
-- `role_permissions.module_id` and `site_user_permission_overrides.module_id`
-- both FK to `modules(id)` WITHOUT `ON UPDATE CASCADE`, so child rows
-- must be updated before the parent (and deleted before the parent for
-- the DPR removal).

BEGIN;

-- DPR cleanup: drop child rows first, then the module.
DELETE FROM site_user_permission_overrides WHERE module_id = 'DPR';
DELETE FROM role_permissions WHERE module_id = 'DPR';
DELETE FROM modules WHERE id = 'DPR';

-- LABOUR → WORKERS rename: update child rows first, then parent.
UPDATE role_permissions SET module_id = 'WORKERS' WHERE module_id = 'LABOUR';
UPDATE site_user_permission_overrides SET module_id = 'WORKERS' WHERE module_id = 'LABOUR';
UPDATE modules SET id = 'WORKERS', label = 'Workers' WHERE id = 'LABOUR';

COMMIT;
