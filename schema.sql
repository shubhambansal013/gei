-- =============================================================================
-- schema.sql
-- GEI
-- Last updated: 2026-04-20
--
-- Single source of truth for current DB state.
-- Update in-place. Apply changes to live DB via Supabase SQL Editor.
-- =============================================================================


-- =============================================================================
-- AUDIT LOG
-- =============================================================================

CREATE TABLE inventory_edit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL CHECK (table_name IN ('purchases', 'issues')),
  row_id      UUID NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  changed_at  TIMESTAMPTZ DEFAULT now(),
  reason      TEXT,
  before_data JSONB NOT NULL,
  after_data  JSONB NOT NULL
);

CREATE INDEX idx_edit_log_table_row   ON inventory_edit_log(table_name, row_id);
CREATE INDEX idx_edit_log_changed_at  ON inventory_edit_log(changed_at DESC);

ALTER TABLE inventory_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edit_log_select" ON inventory_edit_log
  FOR SELECT USING (
    (
      table_name = 'purchases'
      AND EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.id = row_id
          AND can_user(auth.uid(), p.site_id, 'INVENTORY', 'VIEW')
      )
    )
    OR
    (
      table_name = 'issues'
      AND EXISTS (
        SELECT 1 FROM issues i
        WHERE i.id = row_id
          AND can_user(auth.uid(), i.site_id, 'INVENTORY', 'VIEW')
      )
    )
  );

CREATE OR REPLACE FUNCTION log_inventory_edit()
RETURNS TRIGGER AS $$
DECLARE
  v_reason TEXT;
BEGIN
  -- current_setting with missing_ok=true returns '' if not set.
  v_reason := current_setting('app.edit_reason', true);

  INSERT INTO inventory_edit_log (
    table_name, row_id, changed_by, reason, before_data, after_data
  )
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    auth.uid(),
    NULLIF(v_reason, ''),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE txn_party_type AS ENUM (
  'SITE_STORE',
  'LOCATION',
  'CONTRACTOR',
  'EXTERNAL_SITE',
  'SUPPLIER'
);


-- =============================================================================
-- REFERENCE / LOOKUP TABLES
-- =============================================================================

CREATE TABLE units (
  id       TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  category TEXT
);

INSERT INTO units (id, label, category) VALUES
  ('NOS',  'Numbers',       'count'),
  ('MTR',  'Metre',         'length'),
  ('RMT',  'Running Metre', 'length'),
  ('SQFT', 'Square Feet',   'area'),
  ('SQM',  'Square Metre',  'area'),
  ('CUM',  'Cubic Metre',   'volume'),
  ('KG',   'Kilogram',      'weight'),
  ('MT',   'Metric Tonne',  'weight'),
  ('LTR',  'Litre',         'volume'),
  ('SET',  'Set',           'count'),
  ('LOT',  'Lot',           'count'),
  ('COIL', 'Coil',          'count'),
  ('PKT',  'Packet',        'count'),
  ('BOX',  'Box',           'count'),
  ('BAG',  'Bag',           'count');


CREATE TABLE item_categories (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO item_categories (id, label) VALUES
  ('ELECTRICAL', 'Electrical'),
  ('CIVIL',      'Civil'),
  ('PLUMBING',   'Plumbing'),
  ('FINISHING',  'Finishing'),
  ('HARDWARE',   'Hardware'),
  ('SANITARY',   'Sanitary');


CREATE TABLE location_types (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO location_types (id, label) VALUES
  ('VILLA',  'Villa'),
  ('BLOCK',  'Block'),
  ('FLAT',   'Flat'),
  ('FLOOR',  'Floor'),
  ('ROOM',   'Room'),
  ('AREA',   'Area'),
  ('WING',   'Wing'),
  ('LOBBY',  'Lobby'),
  ('UNIT',   'Unit');


CREATE TABLE party_types (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO party_types (id, label) VALUES
  ('SUPPLIER',      'Supplier'),
  ('CONTRACTOR',    'Contractor'),
  ('SUBCONTRACTOR', 'Sub-Contractor'),
  ('CLIENT',        'Client'),
  ('CONSULTANT',    'Consultant');


-- =============================================================================
-- SITES
-- =============================================================================

CREATE TABLE sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE NOT NULL,
  type       TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- PARTIES
-- =============================================================================

CREATE TABLE parties (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL REFERENCES party_types(id),
  short_code TEXT,
  gstin      TEXT,
  phone      TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT parties_short_code_fmt
    CHECK (short_code IS NULL OR short_code ~ '^[A-Z0-9]{2,8}$')
);

CREATE UNIQUE INDEX parties_short_code_uk
  ON parties(short_code)
  WHERE short_code IS NOT NULL;


-- =============================================================================
-- ITEMS MASTER
-- code              = GEI_code (internal short code for fast entry)
-- stock_unit        = canonical unit stock is tracked and issued in
-- =============================================================================

CREATE TABLE items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  code              TEXT UNIQUE,
  category_id       TEXT REFERENCES item_categories(id),
  stock_unit        TEXT NOT NULL REFERENCES units(id),
  hsn_code          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- LOCATION SYSTEM
-- =============================================================================

CREATE TABLE location_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  type        TEXT NOT NULL REFERENCES location_types(id),

  UNIQUE (site_id, code)
);


-- =============================================================================
-- AUTH & RBAC
-- Profiles extends auth.users (managed by Supabase).
-- site_user_access controls per-site access.
-- can_user() is the single permission check used by RLS and app code.
-- =============================================================================

CREATE TABLE roles (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  level       INTEGER NOT NULL
);

INSERT INTO roles (id, label, level, description) VALUES
  ('SUPER_ADMIN',   'Super Admin',   1, 'Full access to everything.'),
  ('ADMIN',         'Admin',         2, 'Full access on assigned sites.'),
  ('STORE_MANAGER', 'Store Manager', 3, 'Inventory read/write on assigned sites.'),
  ('SITE_ENGINEER', 'Site Engineer', 4, 'Workers read, inventory read.'),
  ('VIEWER',        'Viewer',        5, 'Read-only on assigned sites.');


CREATE TABLE modules (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO modules (id, label) VALUES
  ('INVENTORY', 'Inventory'),
  ('WORKERS',   'Workers'),
  ('LOCATION',  'Location Master'),
  ('REPORTS',   'Reports & Analytics');


CREATE TABLE actions (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO actions (id, label) VALUES
  ('VIEW',   'View'),
  ('CREATE', 'Create'),
  ('EDIT',   'Edit'),
  ('DELETE', 'Delete'),
  ('EXPORT', 'Export');


CREATE TABLE role_permissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id   TEXT NOT NULL REFERENCES roles(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  action_id TEXT NOT NULL REFERENCES actions(id),

  UNIQUE (role_id, module_id, action_id)
);

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'SUPER_ADMIN', m.id, a.id FROM modules m CROSS JOIN actions a;

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'ADMIN', m.id, a.id FROM modules m CROSS JOIN actions a;

INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('STORE_MANAGER', 'INVENTORY', 'VIEW'),
  ('STORE_MANAGER', 'INVENTORY', 'CREATE'),
  ('STORE_MANAGER', 'INVENTORY', 'EDIT'),
  ('STORE_MANAGER', 'INVENTORY', 'EXPORT'),
  ('STORE_MANAGER', 'WORKERS',   'VIEW'),
  ('STORE_MANAGER', 'WORKERS',   'CREATE'),
  ('STORE_MANAGER', 'WORKERS',   'EDIT'),
  ('STORE_MANAGER', 'WORKERS',   'EXPORT'),
  ('STORE_MANAGER', 'REPORTS',   'VIEW'),
  ('SITE_ENGINEER', 'INVENTORY', 'VIEW'),
  ('SITE_ENGINEER', 'WORKERS',   'VIEW'),
  ('SITE_ENGINEER', 'REPORTS',   'VIEW');

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'VIEWER', m.id, 'VIEW' FROM modules m;


CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role_id     TEXT NOT NULL REFERENCES roles(id) DEFAULT 'VIEWER',
  -- New signups are inactive until admin approval. See
  -- 20260423000002_signup_approval.sql.
  is_active   BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Create the profile inactive — an admin flips the bit via the
-- approveUser server action. See 20260423000002_signup_approval.sql.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role_id, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Issue #22 — privilege-escalation block. The profiles RLS policy
-- allows a user to UPDATE their own row (so they can edit full_name
-- / phone). Without this trigger, that policy also lets them set
-- role_id='SUPER_ADMIN' or flip is_active or stamp their own
-- approved_at/by. The trigger raises 42501 on any non-admin attempt
-- to modify those four privileged columns on their own row.
-- See migration 20260424000001_fix_profile_privilege_escalation.sql.
CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_admin_anywhere(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Non-admin users may only update their own profile.';
  END IF;
  IF NEW.role_id     IS DISTINCT FROM OLD.role_id
  OR NEW.is_active   IS DISTINCT FROM OLD.is_active
  OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Privileged profile columns can only be changed by an administrator.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_block_self_privilege_escalation_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


CREATE TABLE site_user_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id    TEXT NOT NULL REFERENCES roles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES profiles(id),

  UNIQUE (site_id, user_id)
);


CREATE TABLE site_user_permission_overrides (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id UUID NOT NULL REFERENCES site_user_access(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id),
  action_id TEXT NOT NULL REFERENCES actions(id),
  granted   BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (access_id, module_id, action_id)
);


-- can_user must be defined after profiles, site_user_access,
-- site_user_permission_overrides, and role_permissions
CREATE OR REPLACE FUNCTION can_user(
  p_user_id   UUID,
  p_site_id   UUID,
  p_module_id TEXT,
  p_action_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_global_role_id TEXT;
  v_site_role_id   TEXT;
  v_access_id      UUID;
  v_override       BOOLEAN;
  v_permitted      BOOLEAN;
BEGIN
  SELECT role_id INTO v_global_role_id
  FROM profiles
  WHERE id = p_user_id AND is_active = true;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_global_role_id = 'SUPER_ADMIN' THEN RETURN true; END IF;

  SELECT id, role_id INTO v_access_id, v_site_role_id
  FROM site_user_access
  WHERE user_id = p_user_id AND site_id = p_site_id;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT granted INTO v_override
  FROM site_user_permission_overrides
  WHERE access_id = v_access_id
    AND module_id = p_module_id
    AND action_id = p_action_id;

  IF FOUND THEN RETURN v_override; END IF;

  SELECT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role_id   = v_site_role_id
      AND module_id = p_module_id
      AND action_id = p_action_id
  ) INTO v_permitted;

  RETURN v_permitted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_anywhere(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role_id INTO v_role FROM profiles
   WHERE id = p_user_id AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role = 'SUPER_ADMIN' THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM site_user_access
     WHERE user_id = p_user_id AND role_id IN ('SUPER_ADMIN', 'ADMIN')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_on_site(p_user_id UUID, p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
     WHERE id = p_user_id AND is_active = true AND role_id = 'SUPER_ADMIN'
  ) OR EXISTS (
    SELECT 1 FROM site_user_access
     WHERE user_id = p_user_id AND site_id = p_site_id AND role_id IN ('SUPER_ADMIN', 'ADMIN')
  );
END;
$$;


-- =============================================================================
-- PURCHASES
-- Goods receipt / inward register.
-- rate is per received_unit (matches supplier invoice).
-- stock_qty = received_qty x unit_conv_factor (in stock_unit).
-- =============================================================================

CREATE TABLE purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES sites(id),
  item_id          UUID NOT NULL REFERENCES items(id),
  supplier_part_no TEXT,
  manufacturer     TEXT,

  received_qty     NUMERIC NOT NULL CHECK (received_qty > 0),
  received_unit    TEXT NOT NULL REFERENCES units(id),
  stock_unit       TEXT NOT NULL REFERENCES units(id),
  unit_conv_factor NUMERIC NOT NULL DEFAULT 1 CHECK (unit_conv_factor > 0),
  stock_qty        NUMERIC GENERATED ALWAYS AS
                   (ROUND(received_qty * unit_conv_factor, 4)) STORED,

  rate             NUMERIC CHECK (rate >= 0),
  total_amount     NUMERIC GENERATED ALWAYS AS
                   (ROUND(received_qty * rate, 2)) STORED,

  vendor_id        UUID REFERENCES parties(id),
  invoice_no       TEXT,
  invoice_date     DATE,
  receipt_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  hsn_sac          TEXT,

  remarks          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  created_by       UUID REFERENCES profiles(id),

  is_deleted       BOOLEAN DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID REFERENCES profiles(id),
  delete_reason    TEXT
);


-- =============================================================================
-- ISSUES
-- Material outward register.
-- qty is positive for issue, negative for return.
-- party_id and location_unit_id can both be filled (contractor at a location).
-- dest_site_id is mutually exclusive with the other two.
--
-- worker_id        = structured FK to the worker who received the material
--                    (post-workforce cutover).
-- issued_to_legacy = pre-workforce free-text name of receiver. Kept so
--                    historical rows remain readable + exportable. New
--                    rows route through `worker_id` instead.
-- chk_issue_recipient: at least one of the two must be set.
-- =============================================================================

CREATE TABLE issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  item_id           UUID NOT NULL REFERENCES items(id),

  qty               NUMERIC NOT NULL CHECK (qty != 0),
  unit              TEXT NOT NULL REFERENCES units(id),

  location_unit_id  UUID REFERENCES location_units(id),
  party_id          UUID REFERENCES parties(id),
  dest_site_id      UUID REFERENCES sites(id),

  worker_id         UUID REFERENCES workers(id),
  issued_to_legacy  TEXT,
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES profiles(id),

  is_deleted        BOOLEAN DEFAULT false,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES profiles(id),
  delete_reason     TEXT,

  -- at least one destination must be filled
  -- dest_site_id is mutually exclusive with location and party
  CONSTRAINT chk_issue_destination CHECK (
    (
      dest_site_id IS NULL
      AND (location_unit_id IS NOT NULL OR party_id IS NOT NULL)
    )
    OR
    (
      dest_site_id IS NOT NULL
      AND location_unit_id IS NULL
      AND party_id IS NULL
    )
  ),

  -- at least one recipient pointer (structured or legacy text) must exist
  CONSTRAINT chk_issue_recipient CHECK (
    worker_id IS NOT NULL OR issued_to_legacy IS NOT NULL
  )
);

CREATE TRIGGER trg_purchases_audit
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();

CREATE TRIGGER trg_issues_audit
  AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();


-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE VIEW stock_balance AS
SELECT
  p.site_id,
  p.item_id,
  i.name                              AS item_name,
  i.code                              AS gei_code,
  u.label                             AS unit,
  COALESCE(SUM(p.stock_qty), 0)       AS total_received,
  COALESCE(SUM(iss.qty), 0)           AS net_issued,
  COALESCE(SUM(p.stock_qty), 0)
    - COALESCE(SUM(iss.qty), 0)       AS current_stock
FROM purchases p
JOIN items i ON i.id = p.item_id
JOIN units u ON u.id = i.stock_unit
LEFT JOIN issues iss
       ON iss.site_id   = p.site_id
      AND iss.item_id   = p.item_id
      AND iss.is_deleted = false
WHERE p.is_deleted = false
GROUP BY p.site_id, p.item_id, i.name, i.code, u.label;


CREATE VIEW item_weighted_avg_cost AS
SELECT
  site_id,
  item_id,
  ROUND(
    SUM(stock_qty * (rate / NULLIF(unit_conv_factor, 0)))
    / NULLIF(SUM(stock_qty), 0),
    2
  ) AS wac_per_stock_unit
FROM purchases
WHERE is_deleted = false
  AND rate IS NOT NULL
GROUP BY site_id, item_id;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_units      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select" ON purchases
  FOR SELECT USING (can_user(auth.uid(), site_id, 'INVENTORY', 'VIEW'));
CREATE POLICY "purchases_insert" ON purchases
  FOR INSERT WITH CHECK (can_user(auth.uid(), site_id, 'INVENTORY', 'CREATE'));
CREATE POLICY "purchases_update" ON purchases
  FOR UPDATE USING (can_user(auth.uid(), site_id, 'INVENTORY', 'EDIT'));
CREATE POLICY "purchases_no_delete" ON purchases
  FOR DELETE USING (false);

CREATE POLICY "issues_select" ON issues
  FOR SELECT USING (can_user(auth.uid(), site_id, 'INVENTORY', 'VIEW'));
CREATE POLICY "issues_insert" ON issues
  FOR INSERT WITH CHECK (can_user(auth.uid(), site_id, 'INVENTORY', 'CREATE'));
CREATE POLICY "issues_update" ON issues
  FOR UPDATE USING (can_user(auth.uid(), site_id, 'INVENTORY', 'EDIT'));
CREATE POLICY "issues_no_delete" ON issues
  FOR DELETE USING (false);

CREATE POLICY "location_units_select" ON location_units
  FOR SELECT USING (can_user(auth.uid(), site_id, 'LOCATION', 'VIEW'));

-- location_units writes: admins only. See
-- migration 20260423000001_write_policies.sql. `is_admin_anywhere` is
-- defined in 20260420000004_masters_rls.sql (mirrored below).
CREATE POLICY "location_units_insert_admin" ON location_units
  FOR INSERT WITH CHECK (is_admin_anywhere(auth.uid()));
CREATE POLICY "location_units_update_admin" ON location_units
  FOR UPDATE USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
CREATE POLICY "location_units_delete_admin" ON location_units
  FOR DELETE USING (is_admin_anywhere(auth.uid()));

-- site_user_permission_overrides: RLS enabled by
-- 20260423000001_write_policies.sql.
ALTER TABLE site_user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overrides_select_self_or_admin" ON site_user_permission_overrides
  FOR SELECT USING (
    is_admin_anywhere(auth.uid())
    OR EXISTS (
      SELECT 1 FROM site_user_access sua
      WHERE sua.id = site_user_permission_overrides.access_id
        AND sua.user_id = auth.uid()
    )
  );
CREATE POLICY "overrides_insert_admin" ON site_user_permission_overrides
  FOR INSERT WITH CHECK (is_admin_anywhere(auth.uid()));
CREATE POLICY "overrides_update_admin" ON site_user_permission_overrides
  FOR UPDATE USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
CREATE POLICY "overrides_delete_admin" ON site_user_permission_overrides
  FOR DELETE USING (is_admin_anywhere(auth.uid()));

-- -----------------------------------------------------------------------
-- Masters SELECT policies, post-Security-Wave-1 (20260423000002):
-- authenticated AND is_active=true. Keeps the pre-approval pipeline
-- from leaking the item / party catalog to new signups.
-- -----------------------------------------------------------------------
CREATE POLICY "items_select_all" ON items
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "parties_select_all" ON parties
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "sites_select_accessible" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid()
         AND role_id = 'SUPER_ADMIN'
         AND is_active = true
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles
         WHERE id = auth.uid() AND is_active = true
      )
      AND EXISTS (
        SELECT 1 FROM site_user_access
         WHERE user_id = auth.uid() AND site_id = sites.id
      )
    )
  );


-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_sites_code               ON sites(code);
CREATE INDEX idx_items_code               ON items(code);
CREATE INDEX idx_items_category           ON items(category_id);

CREATE INDEX idx_purchases_site_item      ON purchases(site_id, item_id);
CREATE INDEX idx_purchases_date           ON purchases(receipt_date);
CREATE INDEX idx_purchases_vendor         ON purchases(vendor_id);
CREATE INDEX idx_purchases_deleted        ON purchases(is_deleted);

CREATE INDEX idx_issues_site_item         ON issues(site_id, item_id);
CREATE INDEX idx_issues_date              ON issues(issue_date);
CREATE INDEX idx_issues_location_unit     ON issues(location_unit_id);
CREATE INDEX idx_issues_party             ON issues(party_id);
CREATE INDEX idx_issues_worker            ON issues(worker_id);
CREATE INDEX idx_issues_deleted           ON issues(is_deleted);

CREATE INDEX idx_location_units_site      ON location_units(site_id);
CREATE INDEX idx_location_units_site_code ON location_units(site_id, code);

CREATE INDEX idx_profiles_role            ON profiles(role_id);
CREATE INDEX idx_profiles_active          ON profiles(is_active);
CREATE INDEX idx_site_access_user         ON site_user_access(user_id);
CREATE INDEX idx_site_access_site         ON site_user_access(site_id);
CREATE INDEX idx_overrides_access         ON site_user_permission_overrides(access_id);


-- =============================================================================
-- WORKFORCE DOMAIN (migration 20260423000005_workforce.sql)
-- A Worker aggregate carries:
--   * workers (the aggregate root; code minted by trigger, immutable)
--   * worker_site_assignments (history of placements; no-overlap)
--   * worker_affiliations (history of employment type; no-overlap)
-- Invariants:
--   * code is W-#### and immutable after mint (BEFORE UPDATE trigger)
--   * DIRECT ⇔ no contractor_party_id; other types ⇔ contractor required
--   * at most one OPEN site-assignment / affiliation (effective_to NULL)
--     — enforced in the server action; EXCLUDE stops overlap
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE employment_type AS ENUM (
  'DIRECT',
  'CONTRACTOR_EMPLOYEE',
  'SUBCONTRACTOR_LENT'
);

CREATE SEQUENCE worker_code_seq START 1;

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

CREATE INDEX wa_worker_idx     ON worker_affiliations(worker_id);
CREATE INDEX wa_contractor_idx ON worker_affiliations(contractor_party_id);
CREATE INDEX wa_open_idx       ON worker_affiliations(worker_id)
  WHERE effective_to IS NULL;

-- Mint + freeze triggers (see migration for definitions).
-- BEFORE INSERT: `code := 'W-' || lpad(nextval('worker_code_seq')::text, 4, '0')`
-- BEFORE UPDATE: raise if NEW.code <> OLD.code.
-- RLS policies follow the can_user(..., 'WORKERS', ...) pattern for
-- writes; reads require is_active AND (admin-anywhere OR site access).

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_affiliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers_select" ON workers
  FOR SELECT USING (is_admin_on_site(auth.uid(), current_site_id) OR can_user(auth.uid(), current_site_id, 'WORKERS', 'VIEW'));

CREATE POLICY "workers_insert" ON workers
  FOR INSERT WITH CHECK (can_user(auth.uid(), current_site_id, 'WORKERS', 'CREATE'));

CREATE POLICY "workers_update" ON workers
  FOR UPDATE USING (can_user(auth.uid(), current_site_id, 'WORKERS', 'EDIT'));

CREATE POLICY "wsa_select" ON worker_site_assignments
  FOR SELECT USING (is_admin_on_site(auth.uid(), site_id) OR can_user(auth.uid(), site_id, 'WORKERS', 'VIEW'));

CREATE POLICY "wsa_insert" ON worker_site_assignments
  FOR INSERT WITH CHECK (is_admin_on_site(auth.uid(), site_id) OR can_user(auth.uid(), site_id, 'WORKERS', 'EDIT'));

CREATE POLICY "wa_select" ON worker_affiliations
  FOR SELECT USING (is_admin_anywhere(auth.uid()) OR EXISTS (
    SELECT 1 FROM worker_site_assignments wsa
    WHERE wsa.worker_id = worker_affiliations.worker_id
    AND (is_admin_on_site(auth.uid(), wsa.site_id) OR can_user(auth.uid(), wsa.site_id, 'WORKERS', 'VIEW'))
  ));


-- =============================================================================
-- RLS: units + role_permissions (Wave 6)
-- =============================================================================
--
-- Mirrored from migrations 20260423000008 and 20260423000009 so the
-- canonical schema stays in sync. Both tables are tenant-wide reference
-- data: SELECT is open to every authenticated user; WRITE is restricted.

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_all" ON units
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "units_write_admin" ON units
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_all" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- SUPER_ADMIN-only: a change here silently widens authority on every
-- site. Site ADMINs must use `site_user_permission_overrides`.
CREATE POLICY "role_permissions_write_super_admin" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid()
         AND is_active = true
         AND role_id = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid()
         AND is_active = true
         AND role_id = 'SUPER_ADMIN'
    )
  );


-- =============================================================================
-- SEEDING A NEW SITE
-- =============================================================================

-- INSERT INTO sites (name, code, type) VALUES ('RGIPT Sivasagar', 'RGIPT-SIV', 'hostel');

-- INSERT INTO location_units (site_id, name, code, type)
-- SELECT 'site-uuid', 'Block ' || n, n::TEXT, 'block'
-- FROM generate_series(1, 10) AS n;

-- INSERT INTO site_user_access (site_id, user_id, role_id, granted_by)
-- VALUES ('site-uuid', 'user-uuid', 'STORE_MANAGER', 'your-uuid');
