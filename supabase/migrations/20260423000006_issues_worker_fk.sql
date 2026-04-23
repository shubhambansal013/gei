-- 20260423000006_issues_worker_fk.sql
-- Issue #16 — structurally link `issues` to `workers`.
--
-- Historical state:  issues.issued_to TEXT — free-text name, no FK.
-- New state:         issues.worker_id UUID REFERENCES workers(id) — the
--                    structured pointer for rows created after workforce
--                    cutover. The old text column is renamed to
--                    `issued_to_legacy` so existing rows stay readable
--                    and exportable forever.
--
-- Routing rule (enforced by `chk_issue_recipient`): every `issues` row
-- must carry EITHER a `worker_id` OR an `issued_to_legacy` (or both).
-- The UI now routes new rows through `worker_id`; legacy text-only rows
-- remain valid in place.

BEGIN;

ALTER TABLE issues RENAME COLUMN issued_to TO issued_to_legacy;

ALTER TABLE issues
  ADD COLUMN worker_id UUID REFERENCES workers(id);

ALTER TABLE issues
  ADD CONSTRAINT chk_issue_recipient CHECK (
    worker_id IS NOT NULL OR issued_to_legacy IS NOT NULL
  );

CREATE INDEX idx_issues_worker ON issues(worker_id);

COMMIT;
