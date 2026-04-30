-- 20260426000002_drop_issued_to_legacy.sql
-- Drop the `issued_to_legacy` column as it is no longer used.
-- All issues must now have a valid `worker_id`.

BEGIN;

-- Drop the column
ALTER TABLE issues DROP COLUMN issued_to_legacy;

-- Drop the constraint that allowed either worker_id or issued_to_legacy
ALTER TABLE issues DROP CONSTRAINT IF EXISTS chk_issue_recipient;

-- Enforce that all issues must have a worker_id
ALTER TABLE issues ALTER COLUMN worker_id SET NOT NULL;

COMMIT;
