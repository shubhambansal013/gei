-- =============================================================================
-- schema.sql
-- GEI
--
-- Single source of truth for current DB state.
-- Update in-place. Apply changes to live DB via Supabase SQL Editor.
-- =============================================================================


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
  ('PCS',  'Pieces',        'count'),
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
  gstin      TEXT,
  phone      TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- ITEMS MASTER
-- code = GEI_code (internal short code for fast entry)
-- unit = canonical stock unit
-- =============================================================================

CREATE TABLE items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,
  category_id TEXT REFERENCES item_categories(id),
  unit        TEXT NOT NULL REFERENCES units(id),
  hsn_code    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- LOCATION SYSTEM
-- Layer 1: Templates (reusable structure)
-- Layer 2: Units per site (Villa 6, Block A)
-- Layer 3: References — resolved on first use, never pre-populated
-- =============================================================================

CREATE TABLE location_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE location_template_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES location_templates(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES location_template_nodes(id),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  type        TEXT NOT NULL REFERENCES location_types(id),
  position    INTEGER,

  UNIQUE (template_id, parent_id, code)
);

CREATE TABLE location_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  type        TEXT NOT NULL REFERENCES location_types(id),
  template_id UUID REFERENCES location_templates(id),
  position    INTEGER,

  UNIQUE (site_id, code)
);

CREATE TABLE location_references (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES sites(id),
  unit_id          UUID NOT NULL REFERENCES location_units(id),
  template_node_id UUID REFERENCES location_template_nodes(id),
  full_path        TEXT NOT NULL,
  full_code        TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE (unit_id, template_node_id)
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
  ('SITE_ENGINEER', 'Site Engineer', 4, 'DPR read/write, inventory read.'),
  ('VIEWER',        'Viewer',        5, 'Read-only on assigned sites.');


CREATE TABLE modules (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO modules (id, label) VALUES
  ('INVENTORY', 'Inventory'),
  ('DPR',       'Daily Progress Report'),
  ('WORKER',    'Worker Management'),
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
  ('STORE_MANAGER', 'REPORTS',   'VIEW'),
  ('SITE_ENGINEER', 'DPR',       'VIEW'),
  ('SITE_ENGINEER', 'DPR',       'CREATE'),
  ('SITE_ENGINEER', 'DPR',       'EDIT'),
  ('SITE_ENGINEER', 'INVENTORY', 'VIEW'),
  ('SITE_ENGINEER', 'WORKER',    'VIEW'),
  ('SITE_ENGINEER', 'REPORTS',   'VIEW');

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'VIEWER', m.id, 'VIEW' FROM modules m;


CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  role_id    TEXT NOT NULL REFERENCES roles(id) DEFAULT 'VIEWER',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
-- party_id and location_ref_id can both be filled (contractor at a location).
-- dest_site_id is mutually exclusive with the other two.
-- issued_to = name of person who physically received the material.
-- =============================================================================

CREATE TABLE issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),
  item_id         UUID NOT NULL REFERENCES items(id),

  qty             NUMERIC NOT NULL CHECK (qty != 0),
  unit            TEXT NOT NULL REFERENCES units(id),

  location_ref_id UUID REFERENCES location_references(id),
  party_id        UUID REFERENCES parties(id),
  dest_site_id    UUID REFERENCES sites(id),

  issued_to       TEXT,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES profiles(id),

  is_deleted      BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES profiles(id),
  delete_reason   TEXT,

  -- at least one destination must be filled
  -- dest_site_id is mutually exclusive with location and party
  CONSTRAINT chk_issue_destination CHECK (
    (
      dest_site_id IS NULL
      AND (location_ref_id IS NOT NULL OR party_id IS NOT NULL)
    )
    OR
    (
      dest_site_id IS NOT NULL
      AND location_ref_id IS NULL
      AND party_id IS NULL
    )
  )
);


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
JOIN units u ON u.id = i.unit
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
-- RESOLVE LOCATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION resolve_location(
  p_site_id UUID,
  p_code    TEXT
)
RETURNS UUID AS $$
DECLARE
  v_parts     TEXT[];
  v_unit_code TEXT;
  v_unit      location_units%ROWTYPE;
  v_node_id   UUID := NULL;
  v_part      TEXT;
  v_full_path TEXT;
  v_ref_id    UUID;
BEGIN
  v_parts     := string_to_array(p_code, '-');
  v_unit_code := v_parts[1];

  SELECT * INTO v_unit
  FROM location_units
  WHERE site_id = p_site_id AND code = v_unit_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit code % not found for this site', v_unit_code;
  END IF;

  v_full_path := v_unit.name;

  FOR i IN 2..array_length(v_parts, 1) LOOP
    v_part := v_parts[i];

    SELECT id INTO v_node_id
    FROM location_template_nodes
    WHERE template_id = v_unit.template_id
      AND parent_id   IS NOT DISTINCT FROM v_node_id
      AND code        = v_part;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Node code % not found in template at level %', v_part, i;
    END IF;

    SELECT v_full_path || ' > ' || name INTO v_full_path
    FROM location_template_nodes
    WHERE id = v_node_id;
  END LOOP;

  INSERT INTO location_references
    (site_id, unit_id, template_node_id, full_path, full_code)
  VALUES
    (p_site_id, v_unit.id, v_node_id, v_full_path, p_code)
  ON CONFLICT (unit_id, template_node_id) DO NOTHING
  RETURNING id INTO v_ref_id;

  IF v_ref_id IS NULL THEN
    SELECT id INTO v_ref_id
    FROM location_references
    WHERE unit_id          = v_unit.id
      AND template_node_id IS NOT DISTINCT FROM v_node_id;
  END IF;

  RETURN v_ref_id;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_units      ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_references ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "location_refs_select" ON location_references
  FOR SELECT USING (can_user(auth.uid(), site_id, 'LOCATION', 'VIEW'));


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
CREATE INDEX idx_issues_location          ON issues(location_ref_id);
CREATE INDEX idx_issues_party             ON issues(party_id);
CREATE INDEX idx_issues_deleted           ON issues(is_deleted);

CREATE INDEX idx_location_units_site      ON location_units(site_id);
CREATE INDEX idx_location_units_site_code ON location_units(site_id, code);
CREATE INDEX idx_template_nodes_template  ON location_template_nodes(template_id);
CREATE INDEX idx_template_nodes_parent    ON location_template_nodes(parent_id);
CREATE INDEX idx_location_refs_site       ON location_references(site_id);
CREATE INDEX idx_location_refs_unit       ON location_references(unit_id);
CREATE INDEX idx_location_refs_code       ON location_references(site_id, full_code);
CREATE INDEX idx_location_refs_fts        ON location_references
  USING gin(to_tsvector('english', full_path));

CREATE INDEX idx_profiles_role            ON profiles(role_id);
CREATE INDEX idx_profiles_active          ON profiles(is_active);
CREATE INDEX idx_site_access_user         ON site_user_access(user_id);
CREATE INDEX idx_site_access_site         ON site_user_access(site_id);
CREATE INDEX idx_overrides_access         ON site_user_permission_overrides(access_id);


-- =============================================================================
-- SEEDING A NEW SITE
-- =============================================================================

-- INSERT INTO sites (name, code, type) VALUES ('RGIPT Sivasagar', 'RGIPT-SIV', 'hostel');

-- INSERT INTO location_units (site_id, name, code, type, template_id)
-- SELECT 'site-uuid', 'Block ' || n, n::TEXT, 'block', 'template-uuid'
-- FROM generate_series(1, 10) AS n;

-- INSERT INTO site_user_access (site_id, user_id, role_id, granted_by)
-- VALUES ('site-uuid', 'user-uuid', 'STORE_MANAGER', 'your-uuid');
-- Adds: reorder_level on items, rate on issues, updated_at on mutable tables.

ALTER TABLE items
  ADD COLUMN reorder_level NUMERIC CHECK (reorder_level IS NULL OR reorder_level >= 0);

ALTER TABLE issues
  ADD COLUMN rate NUMERIC CHECK (rate IS NULL OR rate >= 0);

ALTER TABLE purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE issues    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Captures every UPDATE on purchases and issues.
-- Reason flows in via a session-local GUC: SET LOCAL app.edit_reason = '...'.

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

CREATE TRIGGER trg_purchases_audit
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();

CREATE TRIGGER trg_issues_audit
  AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();
-- Masters (items, parties, sites) are tenant-wide. Any authenticated user
-- can SELECT. Only SUPER_ADMIN globally, or ADMIN on any site, can write.

CREATE OR REPLACE FUNCTION is_admin_anywhere(p_user_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_all" ON items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "items_write_admin" ON items
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "parties_select_all" ON parties
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "parties_write_admin" ON parties
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "sites_select_accessible" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid() AND role_id = 'SUPER_ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM site_user_access
       WHERE user_id = auth.uid() AND site_id = sites.id
    )
  );
CREATE POLICY "sites_write_admin" ON sites
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

-- profiles: user sees own profile; admins see all.
CREATE POLICY "profiles_select_self_or_admin" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR is_admin_anywhere(auth.uid())
  );
CREATE POLICY "profiles_update_self_or_admin" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR is_admin_anywhere(auth.uid())
  );

CREATE POLICY "sua_select_self_or_admin" ON site_user_access
  FOR SELECT USING (
    user_id = auth.uid() OR is_admin_anywhere(auth.uid())
  );
CREATE POLICY "sua_write_admin" ON site_user_access
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
-- The base schema's handle_new_user() trigger function referenced
-- `profiles` unqualified. When fired from auth.users inserts, the
-- search_path does not include `public` and the function fails with:
--   relation "profiles" does not exist (SQLSTATE 42P01)
-- which surfaces to clients as a 500 "Database error creating new user".
--
-- Fix: qualify the insert as `public.profiles`. Same for any subsequent
-- statements that might depend on search_path.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
--
-- Before this migration:
--   * `location_units` and `location_references` had RLS enabled with
--     SELECT-only policies, so even SUPER_ADMIN INSERT/UPDATE/DELETE
--     got SQLSTATE 42501.
--   * `site_user_permission_overrides` had no RLS at all — a plain
--     authenticated user could read or edit anyone's overrides.
--
-- Fix: enable RLS on overrides; add admin-only write policies to all

-- -----------------------------------------------------------------------
-- location_units — admin-only writes
-- -----------------------------------------------------------------------
CREATE POLICY "location_units_insert_admin" ON location_units
  FOR INSERT WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "location_units_update_admin" ON location_units
  FOR UPDATE USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "location_units_delete_admin" ON location_units
  FOR DELETE USING (is_admin_anywhere(auth.uid()));

-- -----------------------------------------------------------------------
-- location_references — admin-only writes. Regular writes happen via
-- `resolve_location()` which is SECURITY DEFINER, so non-admin server
-- actions that go through the RPC still work.
-- -----------------------------------------------------------------------
CREATE POLICY "location_refs_insert_admin" ON location_references
  FOR INSERT WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "location_refs_update_admin" ON location_references
  FOR UPDATE USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

CREATE POLICY "location_refs_delete_admin" ON location_references
  FOR DELETE USING (is_admin_anywhere(auth.uid()));

-- -----------------------------------------------------------------------
-- site_user_permission_overrides — enable RLS + admin-only CRUD.
-- SELECT policy allows the target user to see their own overrides
-- (via the owning site_user_access row) and admins to see everything.
-- -----------------------------------------------------------------------
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
--
-- Problem: new Google OAuth signups were auto-active with role=VIEWER,
-- and VIEWER has view-all on every module. Combined with
-- `items_select_all` / `parties_select_all` (which only checked
-- `auth.uid() IS NOT NULL`), that meant anyone who could Sign In With
-- Google saw every item and party in the tenant the moment they
-- landed on the login page.
--
-- Fix: new signups start with `is_active=false`. The masters SELECT
-- policies additionally require `is_active=true`. An admin flips the
-- gate via `approveUser`. `can_user()` already returned false for
-- inactive users, so transactional RLS needed no change.

-- -----------------------------------------------------------------------
-- profiles: default inactive + approval metadata
-- -----------------------------------------------------------------------
ALTER TABLE profiles
  ALTER COLUMN is_active SET DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by UUID REFERENCES profiles(id);

-- Preserve existing users. Rows already marked active were approved
-- implicitly by whoever first created them — stamp `approved_at` so
-- the audit history is not empty.
UPDATE profiles
   SET approved_at = created_at
 WHERE is_active = true
   AND approved_at IS NULL;

-- -----------------------------------------------------------------------
-- handle_new_user: create profile inactive, role=VIEWER by default.
-- The approval flow (a server action gated on admin RLS) flips the
-- bit and stamps approved_at/approved_by.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_id, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------
-- Close the masters SELECT hole. The original policies from
-- the user also has to be active — i.e., admin-approved.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "items_select_all" ON items;
CREATE POLICY "items_select_all" ON items
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "parties_select_all" ON parties;
CREATE POLICY "parties_select_all" ON parties
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Sites SELECT already requires either SUPER_ADMIN (via role) or a
-- site_user_access row, but didn't gate on is_active. Tighten both
-- branches so a deactivated admin cannot peek.
DROP POLICY IF EXISTS "sites_select_accessible" ON sites;
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


-- DPR cleanup: drop child rows first, then the module.
DELETE FROM site_user_permission_overrides WHERE module_id = 'DPR';
DELETE FROM role_permissions WHERE module_id = 'DPR';
DELETE FROM modules WHERE id = 'DPR';

-- Items master gains a canonical stock unit and default conversion factor.
--
-- Motivation:
--   Construction stores receive materials in one unit (e.g. a 100m ROLL of
--   wire) but track and issue in another (e.g. METRES). Today the `items`
--   table stores a single `unit` column while every `purchases` row
--   re-declares `received_unit`, `stock_unit`, and `unit_conv_factor`.
--   That forces non-technical users to re-enter conversion info on every
--   inward. We lift the canonical stock unit + default multiplier onto
--   the item so the inward form can default-fill them.
--
-- Changes:
--   * items.unit           -> items.stock_unit   (RENAME; Postgres
--     propagates the rename to dependent views such as stock_balance.)
--   * items.stock_conv_factor NUMERIC NOT NULL DEFAULT 1
--     CHECK (stock_conv_factor > 0)
--   * Reinforce the existing purchases.unit_conv_factor > 0 invariant
--     with a named CHECK constraint so future override rows cannot
--     introduce a zero/negative multiplier via data repair scripts.


ALTER TABLE items RENAME COLUMN unit TO stock_unit;

ALTER TABLE items
  ADD COLUMN stock_conv_factor NUMERIC NOT NULL DEFAULT 1
    CHECK (stock_conv_factor > 0);

ALTER TABLE purchases
  ADD CONSTRAINT chk_purchases_unit_conv_factor_positive
    CHECK (unit_conv_factor > 0);

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


ALTER TABLE issues RENAME COLUMN issued_to TO issued_to_legacy;

ALTER TABLE issues
  ADD COLUMN worker_id UUID REFERENCES workers(id);

ALTER TABLE issues
  ADD CONSTRAINT chk_issue_recipient CHECK (
    worker_id IS NOT NULL OR issued_to_legacy IS NOT NULL
  );

CREATE INDEX idx_issues_worker ON issues(worker_id);

-- Issue #19 — optional, unique-when-set short code for parties.
--
-- Site-store workers often refer to a contractor by a 2–3 letter
-- shorthand ("ABC", "MEP", "VAI"). The canonical `name` column is too
-- long to scan in a SearchableSelect dropdown at entry time; a
-- dedicated `short_code` gives a fast-typing key that still round-trips
-- to a human-readable name.
--
-- Constraints:
--   * Optional — NULLable, no default.
--   * When set: 2–8 uppercase letters or digits (no hyphens, no spaces).
--   * Uniqueness is enforced via a partial UNIQUE index (only non-NULL
--     values participate) so multiple NULLs remain legal.
--
-- Note on CONCURRENTLY: Supabase migration files run inside a single
-- transaction; `CREATE INDEX CONCURRENTLY` cannot. The table is small
-- and infrequently written, so a plain UNIQUE INDEX is fine here.


ALTER TABLE parties
  ADD COLUMN short_code TEXT;

ALTER TABLE parties
  ADD CONSTRAINT parties_short_code_fmt
  CHECK (short_code IS NULL OR short_code ~ '^[A-Z0-9]{2,8}$');

CREATE UNIQUE INDEX parties_short_code_uk
  ON parties(short_code)
  WHERE short_code IS NOT NULL;

-- `units` is a tenant-wide reference master. Any authenticated user
-- needs SELECT so the unit dropdown works in every entry form; only
-- admins (SUPER_ADMIN globally or ADMIN on any site — i.e. the same
-- bar as other masters) may mutate it. Mirrors the policy shape in

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_all" ON units
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "units_write_admin" ON units
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
-- `role_permissions` is the tenant-wide default-permission matrix
-- consumed by `can_user()`. A change here silently widens authority
-- on every site, so write access is intentionally narrower than the
-- other masters: SUPER_ADMIN only. Site ADMINs must use per-user
-- overrides (`site_user_permission_overrides`) for exceptions.
--
-- SELECT is open to any authenticated user so the permission-matrix
-- editor UI and client-side `createCan()` caches can read it.

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_all" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

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
-- Issue #22 — Privilege escalation via profiles self-update.
--
-- The `profiles_update_self_or_admin` policy from
-- profile row but has no WITH CHECK clause and no column-level
-- restriction. A SITE_ENGINEER / VIEWER / any authenticated user
-- can therefore:
--   - set `role_id = 'SUPER_ADMIN'` on themselves
--   - set `is_active = false` on themselves or others via the admin
--     policy (already admin-gated, OK) or on themselves via self-policy
--   - stamp fake `approved_at` / `approved_by`
--
-- Fix shape: keep the existing self-UPDATE policy (users legitimately
-- edit their own full_name via /masters/users) but block the four
-- privileged columns with a BEFORE UPDATE trigger. A trigger is safer
-- than a column-level policy because it fires regardless of which
-- policy granted the UPDATE — defence-in-depth against future policy
-- changes that widen self-writes.
--
-- The trigger is SECURITY DEFINER and checks `auth.uid()` and
-- `is_admin_anywhere(auth.uid())` inside plpgsql; if the caller is
-- not an admin AND is updating their own row, any change to
-- role_id / is_active / approved_at / approved_by raises 42501 with
-- a message the pg-error-mapper (lib/actions/errors.ts) will route to
-- the generic "You do not have permission" toast.

CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. BYPASS FOR SYSTEM ADMINISTRATORS
  -- Allows the SQL Editor (postgres) and Dashboard (service_role) to bypass these checks.
  -- This is the "Master Key" that prevents you from being locked out.
  IF current_user = 'postgres' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 2. APPLICATION ADMIN CHECK
  -- If the authenticated user is already an admin, let them do anything.
  IF is_admin_anywhere(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- 3. SECURITY: BLOCK CROSS-USER UPDATES
  -- Prevents User A from changing User B's profile.
  IF auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Non-admin users may only update their own profile.';
  END IF;

  -- 4. SECURITY: BLOCK SELF-PROMOTION
  -- Prevents regular users from making themselves admins or activating their accounts.
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

DROP TRIGGER IF EXISTS profiles_block_self_privilege_escalation_trg ON profiles;
CREATE TRIGGER profiles_block_self_privilege_escalation_trg
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();
-- Move stock_conv_factor from items to purchases
-- Removed from items table as conversion factor is now transaction-specific

ALTER TABLE items DROP COLUMN IF EXISTS stock_conv_factor;
-- Grant LOCATION.VIEW to STORE_MANAGER and SITE_ENGINEER so they can use the Location picker.
INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('STORE_MANAGER', 'LOCATION', 'VIEW'),
  ('SITE_ENGINEER', 'LOCATION', 'VIEW')
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;
-- =============================================================================
-- GEI
-- Simplify location structure by removing templates and references.
-- =============================================================================


-- 1. Drop the location system layers that are being removed.
-- location_references and location_template_nodes have foreign keys to the other tables,
-- so we drop them in order or use CASCADE.
DROP TABLE IF EXISTS location_references CASCADE;
DROP TABLE IF EXISTS location_template_nodes CASCADE;
DROP TABLE IF EXISTS location_templates CASCADE;

-- 2. Drop the resolve_location function as it's no longer needed.
DROP FUNCTION IF EXISTS resolve_location(UUID, TEXT);

-- 3. Modify location_units table: remove template_id.
ALTER TABLE location_units DROP COLUMN IF EXISTS template_id;
ALTER TABLE location_units DROP COLUMN IF EXISTS position;

-- 4. Update issues table: replace location_ref_id with location_unit_id.
-- First, drop the old constraint that depends on location_ref_id.
ALTER TABLE issues DROP CONSTRAINT IF EXISTS chk_issue_destination;

-- Remove the old column and add the new one.
ALTER TABLE issues DROP COLUMN IF EXISTS location_ref_id;
ALTER TABLE issues ADD COLUMN location_unit_id UUID REFERENCES location_units(id);

-- Add the updated constraint.
ALTER TABLE issues ADD CONSTRAINT chk_issue_destination CHECK (
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
);

-- 5. Update indexes on issues.
DROP INDEX IF EXISTS idx_issues_location;
CREATE INDEX idx_issues_location_unit ON issues(location_unit_id);

