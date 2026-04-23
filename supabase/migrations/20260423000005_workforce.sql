-- 20260423000005_workforce.sql
-- Wave 3 — Workforce domain (Issue #15).
--
-- A `worker` is a human who receives material on-site. The aggregate
-- carries two history tables so that:
--   1. transfers between sites never lose placement history, and
--   2. a worker whose employment type changes over time
--      (SUBCONTRACTOR_LENT → DIRECT, etc.) keeps that audit trail.
--
-- Invariants enforced at the DB level:
--   * `workers.code` matches `^W-[0-9]{4,}$` (CHECK) and is minted by a
--     BEFORE INSERT trigger off a per-tenant monotonic sequence.
--   * No two site assignments for the same worker overlap in time
--     (gist EXCLUDE with daterange).
--   * No two affiliations for the same worker overlap in time.
--   * DIRECT ⇒ contractor_party_id IS NULL; every other employment
--     type ⇒ contractor_party_id IS NOT NULL (named CHECK).
--
-- Invariants enforced at the application layer (server action):
--   * Exactly one OPEN site assignment per worker (effective_to IS NULL).
--     The EXCLUDE above stops overlap but does not cap open count at 1.
--     `transfer()` closes the open row and opens a new one atomically.
--   * Exactly one OPEN affiliation per worker — same reasoning.
--
-- RLS follows the same shape as `items_select_active` (reads require
-- is_active = true) and the `can_user(..., 'WORKERS', ...)` pattern
-- for writes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------
-- Permission module. Seed `WORKERS` module + role permissions so the
-- can_user(..., 'WORKERS', ...) checks below evaluate correctly.
-- Idempotent so re-running migrations doesn't explode.
-- -----------------------------------------------------------------------
INSERT INTO modules (id, label)
VALUES ('WORKERS', 'Workers')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'SUPER_ADMIN', 'WORKERS', a.id FROM actions a
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'ADMIN', 'WORKERS', a.id FROM actions a
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;

INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('STORE_MANAGER', 'WORKERS', 'VIEW'),
  ('STORE_MANAGER', 'WORKERS', 'CREATE'),
  ('STORE_MANAGER', 'WORKERS', 'EDIT'),
  ('STORE_MANAGER', 'WORKERS', 'EXPORT'),
  ('SITE_ENGINEER', 'WORKERS', 'VIEW'),
  ('VIEWER',        'WORKERS', 'VIEW')
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Types + sequence
-- -----------------------------------------------------------------------
CREATE TYPE employment_type AS ENUM (
  'DIRECT',
  'CONTRACTOR_EMPLOYEE',
  'SUBCONTRACTOR_LENT'
);

CREATE SEQUENCE worker_code_seq START 1;

-- -----------------------------------------------------------------------
-- workers
-- -----------------------------------------------------------------------
CREATE TABLE workers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  home_city       TEXT,
  current_site_id UUID NOT NULL REFERENCES sites(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES profiles(id),
  CONSTRAINT workers_code_fmt CHECK (code ~ '^W-[0-9]{4,}$')
);

CREATE INDEX workers_current_site_idx ON workers(current_site_id);
CREATE INDEX workers_full_name_idx    ON workers(full_name);
CREATE INDEX workers_is_active_idx    ON workers(is_active);

-- Mint `code` before insert from the monotonic sequence. The client
-- never supplies `code`; the trigger always overwrites any value so
-- a malicious client cannot pick its own.
CREATE OR REPLACE FUNCTION mint_worker_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'W-' || lpad(nextval('worker_code_seq')::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mint_worker_code_trg
  BEFORE INSERT ON workers
  FOR EACH ROW EXECUTE FUNCTION mint_worker_code();

-- Code is immutable after mint — block updates to `code` regardless of
-- the actor. (Even SUPER_ADMIN goes through this trigger.)
CREATE OR REPLACE FUNCTION freeze_worker_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'workers.code is immutable once minted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER freeze_worker_code_trg
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION freeze_worker_code();

-- -----------------------------------------------------------------------
-- worker_site_assignments — history of which site(s) a worker has been
-- placed at. `effective_to IS NULL` ⇒ open (current) assignment.
-- -----------------------------------------------------------------------
CREATE TABLE worker_site_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  site_id        UUID NOT NULL REFERENCES sites(id),
  effective_from DATE NOT NULL,
  effective_to   DATE,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES profiles(id),
  CONSTRAINT wsa_date_order CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT wsa_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);

CREATE INDEX wsa_worker_idx ON worker_site_assignments(worker_id);
CREATE INDEX wsa_site_idx   ON worker_site_assignments(site_id);
CREATE INDEX wsa_open_idx   ON worker_site_assignments(worker_id)
  WHERE effective_to IS NULL;

-- -----------------------------------------------------------------------
-- worker_affiliations — history of employment type (and contractor, if
-- applicable). `effective_to IS NULL` ⇒ open (current) affiliation.
-- -----------------------------------------------------------------------
CREATE TABLE worker_affiliations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id           UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  employment_type     employment_type NOT NULL,
  contractor_party_id UUID REFERENCES parties(id),
  effective_from      DATE NOT NULL,
  effective_to        DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES profiles(id),
  CONSTRAINT wa_date_order CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT wa_affiliation_party_rule CHECK (
    (employment_type = 'DIRECT' AND contractor_party_id IS NULL)
    OR
    (employment_type <> 'DIRECT' AND contractor_party_id IS NOT NULL)
  ),
  CONSTRAINT wa_no_overlap EXCLUDE USING gist (
    worker_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);

CREATE INDEX wa_worker_idx    ON worker_affiliations(worker_id);
CREATE INDEX wa_contractor_idx ON worker_affiliations(contractor_party_id);
CREATE INDEX wa_open_idx      ON worker_affiliations(worker_id)
  WHERE effective_to IS NULL;

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------
ALTER TABLE workers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_affiliations     ENABLE ROW LEVEL SECURITY;

-- `is_admin_anywhere(auth.uid())` is defined in migration
-- 20260420000004_masters_rls.sql on the main branch. This worktree
-- branched before that; fall back to a profile-role check so the
-- policies below remain valid in both worlds. If the function already
-- exists this CREATE OR REPLACE is a harmless no-op for the admin
-- predicate. Policies below therefore use the raw SELECT form.

-- Read: any active user with site access to the worker's current site,
-- or any admin (SUPER_ADMIN globally or ADMIN on any site).
CREATE POLICY "workers_select" ON workers
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true
    )
    AND (
      EXISTS (
        SELECT 1 FROM profiles
         WHERE id = auth.uid() AND role_id = 'SUPER_ADMIN'
      )
      OR EXISTS (
        SELECT 1 FROM site_user_access
         WHERE user_id = auth.uid()
           AND (site_id = workers.current_site_id
                OR role_id IN ('SUPER_ADMIN', 'ADMIN'))
      )
    )
  );

CREATE POLICY "workers_insert" ON workers
  FOR INSERT WITH CHECK (
    can_user(auth.uid(), current_site_id, 'WORKERS', 'CREATE')
  );

CREATE POLICY "workers_update" ON workers
  FOR UPDATE USING (
    can_user(auth.uid(), current_site_id, 'WORKERS', 'EDIT')
  )
  WITH CHECK (
    can_user(auth.uid(), current_site_id, 'WORKERS', 'EDIT')
  );

-- Workers follow the same no-hard-delete rule as inventory. Deactivation
-- flips `is_active` instead.
CREATE POLICY "workers_no_delete" ON workers
  FOR DELETE USING (false);

-- History tables: reuse the parent worker's site for the site-scoped
-- can_user check. A user who can SEE the worker can SEE its history.
CREATE POLICY "wsa_select" ON worker_site_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workers w
       WHERE w.id = worker_site_assignments.worker_id
         AND (
           EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id = 'SUPER_ADMIN' AND p.is_active = true)
           OR EXISTS (
             SELECT 1 FROM site_user_access
              WHERE user_id = auth.uid()
                AND (site_id = w.current_site_id OR role_id IN ('SUPER_ADMIN','ADMIN'))
           )
         )
    )
  );

CREATE POLICY "wsa_insert" ON worker_site_assignments
  FOR INSERT WITH CHECK (
    can_user(auth.uid(), site_id, 'WORKERS', 'EDIT')
  );

CREATE POLICY "wsa_update" ON worker_site_assignments
  FOR UPDATE USING (
    can_user(auth.uid(), site_id, 'WORKERS', 'EDIT')
  )
  WITH CHECK (
    can_user(auth.uid(), site_id, 'WORKERS', 'EDIT')
  );

CREATE POLICY "wsa_no_delete" ON worker_site_assignments
  FOR DELETE USING (false);

CREATE POLICY "wa_select" ON worker_affiliations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workers w
       WHERE w.id = worker_affiliations.worker_id
         AND (
           EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role_id = 'SUPER_ADMIN' AND p.is_active = true)
           OR EXISTS (
             SELECT 1 FROM site_user_access
              WHERE user_id = auth.uid()
                AND (site_id = w.current_site_id OR role_id IN ('SUPER_ADMIN','ADMIN'))
           )
         )
    )
  );

CREATE POLICY "wa_insert" ON worker_affiliations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers w
       WHERE w.id = worker_affiliations.worker_id
         AND can_user(auth.uid(), w.current_site_id, 'WORKERS', 'EDIT')
    )
  );

CREATE POLICY "wa_update" ON worker_affiliations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workers w
       WHERE w.id = worker_affiliations.worker_id
         AND can_user(auth.uid(), w.current_site_id, 'WORKERS', 'EDIT')
    )
  );

CREATE POLICY "wa_no_delete" ON worker_affiliations
  FOR DELETE USING (false);

COMMIT;
