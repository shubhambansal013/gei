-- =============================================================================
-- schema.sql
-- GEI
-- Last updated: 2026-04-15
--
-- This file is the single source of truth for the current DB state.
-- Update this file in-place for every schema change.
-- Apply changes to live DB via ALTER statements in Supabase SQL Editor.
-- =============================================================================


-- =============================================================================
-- ENUMS
-- Only used for architectural constants that code logic depends on.
-- For everything else, use reference tables (see below).
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
-- These replace ENUMs for vocabularies that may grow over time.
-- Extend by inserting new rows — no schema change needed.
-- =============================================================================

CREATE TABLE units (
  id       TEXT PRIMARY KEY,   -- canonical code: "mtr", "nos", "kg"
  label    TEXT NOT NULL,      -- display label: "Metre", "Numbers"
  category TEXT                -- grouping: "length", "volume", "weight", "count"
);

INSERT INTO units (id, label, category) VALUES
  ('nos',  'Numbers',       'count'),
  ('mtr',  'Metre',         'length'),
  ('rmt',  'Running Metre', 'length'),
  ('sqft', 'Square Feet',   'area'),
  ('sqm',  'Square Metre',  'area'),
  ('cum',  'Cubic Metre',   'volume'),
  ('kg',   'Kilogram',      'weight'),
  ('mt',   'Metric Tonne',  'weight'),
  ('ltr',  'Litre',         'volume'),
  ('set',  'Set',           'count'),
  ('lot',  'Lot',           'count');


CREATE TABLE txn_types (
  id             TEXT PRIMARY KEY,  -- "inward", "outward", "return", etc.
  label          TEXT NOT NULL,
  affects_stock  INTEGER NOT NULL   -- +1 adds to store, -1 removes, 0 neutral
);

INSERT INTO txn_types (id, label, affects_stock) VALUES
  ('inward',       'Material Inward',    1),
  ('outward',      'Material Issue',    -1),
  ('return',       'Material Return',    1),
  ('transfer_out', 'Transfer Out',      -1),
  ('transfer_in',  'Transfer In',        1);


CREATE TABLE item_categories (
  id    TEXT PRIMARY KEY,   -- "electrical", "civil", "plumbing"
  label TEXT NOT NULL
);

INSERT INTO item_categories (id, label) VALUES
  ('electrical', 'Electrical'),
  ('civil',      'Civil'),
  ('plumbing',   'Plumbing'),
  ('finishing',  'Finishing'),
  ('hardware',   'Hardware'),
  ('sanitary',   'Sanitary');


CREATE TABLE location_types (
  id    TEXT PRIMARY KEY,   -- "villa", "floor", "room", "area"
  label TEXT NOT NULL
);

INSERT INTO location_types (id, label) VALUES
  ('villa',  'Villa'),
  ('block',  'Block'),
  ('tower',  'Tower'),
  ('flat',   'Flat'),
  ('floor',  'Floor'),
  ('room',   'Room'),
  ('area',   'Area'),
  ('wing',   'Wing'),
  ('lobby',  'Lobby'),
  ('unit',   'Unit');


CREATE TABLE party_types (
  id    TEXT PRIMARY KEY,   -- "supplier", "contractor", "subcontractor"
  label TEXT NOT NULL
);

INSERT INTO party_types (id, label) VALUES
  ('supplier',      'Supplier'),
  ('contractor',    'Contractor'),
  ('subcontractor', 'Sub-Contractor'),
  ('client',        'Client'),
  ('consultant',    'Consultant');


-- =============================================================================
-- SITES
-- Top-level entity. Every other table scopes to a site_id.
-- Adding a new site = one INSERT here. Zero schema change.
-- =============================================================================

CREATE TABLE sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,         -- "RGIPT Sivasagar"
  code       TEXT UNIQUE NOT NULL,  -- "RGIPT-SIV"
  type       TEXT,                  -- "hostel", "residential", "commercial"
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- PARTIES
-- Suppliers, contractors, subcontractors — all in one table.
-- A party who is both supplier and contractor is one record.
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
-- Global item list shared across all sites.
-- code enables fast keyboard entry (e.g. "WC-4" for 4mm wire copper).
-- =============================================================================

CREATE TABLE items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,                          -- short code for fast entry
  category_id TEXT REFERENCES item_categories(id),
  unit        TEXT NOT NULL REFERENCES units(id),
  hsn_code    TEXT,                                 -- for GST compliance
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- LOCATION SYSTEM
-- Three-layer design:
--   1. Templates     — reusable structure definitions (e.g. "Standard Villa")
--   2. Units         — actual named units per site (e.g. "Villa 6")
--   3. References    — resolved unit+node combinations, created on first use
--
-- Adding 50 more villas = 50 INSERTs into location_units.
-- Floor/room structure is inherited from template. No duplication.
-- =============================================================================

-- Layer 1: Template definitions
CREATE TABLE location_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,    -- "Standard Villa", "G+4 Hostel Room"
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Layer 1: Template node tree (stored once, reused across all units)
CREATE TABLE location_template_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES location_templates(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES location_template_nodes(id),  -- NULL = root level
  name        TEXT NOT NULL,   -- "First Floor", "Master Bedroom"
  code        TEXT NOT NULL,   -- "1", "2", "MB", "BL" — for fast code entry
  type        TEXT NOT NULL REFERENCES location_types(id),
  position    INTEGER,         -- display ordering among siblings

  -- code must be unique among siblings within same template
  UNIQUE (template_id, parent_id, code)
);

-- Layer 2: Actual units per site
CREATE TABLE location_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- "Villa 6", "Block A", "Flat 201"
  code        TEXT NOT NULL,   -- "6", "A", "201" — first segment of full code
  type        TEXT NOT NULL REFERENCES location_types(id),
  template_id UUID REFERENCES location_templates(id),  -- NULL = irregular unit
  position    INTEGER,

  -- code unique within a site
  UNIQUE (site_id, code)
);

-- Layer 3: Resolved references — the cache
-- Created on first use via resolve_location(). Never pre-populated.
-- full_code examples: "6", "6-1", "6-1-MB"
CREATE TABLE location_references (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES sites(id),
  unit_id          UUID NOT NULL REFERENCES location_units(id),
  template_node_id UUID REFERENCES location_template_nodes(id),  -- NULL = unit level
  full_path        TEXT NOT NULL,  -- "Villa 6 > First Floor > Master Bedroom"
  full_code        TEXT NOT NULL,  -- "6-1-MB"
  created_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE (unit_id, template_node_id)
);

-- Optional: per-site validation rules on location depth
CREATE TABLE site_location_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id),
  template_id   UUID REFERENCES location_templates(id),
  unit_type     TEXT REFERENCES location_types(id),
  min_depth     INTEGER DEFAULT 1,  -- 1 = unit alone is acceptable
  max_depth     INTEGER,            -- NULL = no limit
  enforce       BOOLEAN DEFAULT false  -- false = warn only, true = hard block
);


-- =============================================================================
-- INVENTORY TRANSACTIONS
-- Single ledger table. Every material movement is one row.
-- No separate inward/outward tables — returns and transfers fit naturally.
--
-- destination is modelled as from/to party pairs.
-- txn_party_type ENUM governs what FK is populated on each side.
--
-- Stock balance is always derived from this table. Never stored separately.
-- =============================================================================

CREATE TABLE inventory_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  item_id           UUID NOT NULL REFERENCES items(id),
  quantity          NUMERIC NOT NULL CHECK (quantity > 0),  -- always positive

  -- pricing (filled on inward; outward uses WAC view for valuation)
  unit_rate         NUMERIC CHECK (unit_rate >= 0),
  gst_percent       NUMERIC DEFAULT 0 CHECK (gst_percent >= 0),
  gst_amount        NUMERIC GENERATED ALWAYS AS
                    (ROUND(quantity * unit_rate * gst_percent / 100, 2)) STORED,
  total_amount      NUMERIC GENERATED ALWAYS AS
                    (ROUND(quantity * unit_rate +
                     quantity * unit_rate * gst_percent / 100, 2)) STORED,

  -- transaction type — references txn_types table
  txn_type          TEXT NOT NULL REFERENCES txn_types(id),

  -- FROM party — exactly one FK populated based on from_type
  from_type         txn_party_type NOT NULL,
  from_party_id     UUID REFERENCES parties(id),
  from_location_id  UUID REFERENCES location_references(id),
  from_site_id      UUID REFERENCES sites(id),

  -- TO party — exactly one FK populated based on to_type
  to_type           txn_party_type NOT NULL,
  to_party_id       UUID REFERENCES parties(id),
  to_location_id    UUID REFERENCES location_references(id),
  to_site_id        UUID REFERENCES sites(id),Z

  remarks           TEXT,
  entry_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES profiles(id),  -- set after profiles table exists

  -- soft delete — never hard delete. void + correct instead.
  is_voided         BOOLEAN DEFAULT false,
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT
);


-- =============================================================================
-- VIEWS
-- Derived data. Never store what can be computed.
-- =============================================================================

-- Weighted average cost per item per site (based on inward transactions only)
CREATE VIEW item_weighted_avg_cost AS
SELECT
  site_id,
  item_id,
  ROUND(
    SUM(quantity * unit_rate) / NULLIF(SUM(quantity), 0),
    2
  ) AS weighted_avg_rate
FROM inventory_transactions
WHERE txn_type   = 'INWARD'
  AND is_voided  = false
  AND unit_rate  IS NOT NULL
GROUP BY site_id, item_id;


-- Current stock balance per item per site
-- Uses txn_types.affects_stock so new txn types automatically work
CREATE VIEW stock_balance AS
SELECT
  t.site_id,
  t.item_id,
  i.name                                          AS item_name,
  u.label                                         AS unit,
  SUM(t.quantity * tt.affects_stock)              AS current_stock,
  w.weighted_avg_rate                             AS unit_rate,
  ROUND(
    SUM(t.quantity * tt.affects_stock)
    * COALESCE(w.weighted_avg_rate, 0),
    2
  )                                               AS stock_value
FROM inventory_transactions t
JOIN items i                ON i.id  = t.item_id
JOIN units u                ON u.id  = i.unit
JOIN txn_types tt           ON tt.id = t.txn_type
LEFT JOIN item_weighted_avg_cost w
                            ON w.site_id = t.site_id
                           AND w.item_id = t.item_id
WHERE t.is_voided = false
GROUP BY t.site_id, t.item_id, i.name, u.label, w.weighted_avg_rate;


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- resolve_location: takes a site_id and a location code like "6-1-MB"
-- Returns the location_reference UUID, creating the row if it doesn't exist yet.
-- Partial codes are valid: "6" (unit only), "6-1" (unit + floor).
CREATE OR REPLACE FUNCTION resolve_location(
  p_site_id  UUID,
  p_code     TEXT   -- e.g. "6-1-MB" or "6-1" or "6"
)
RETURNS UUID AS $$
DECLARE
  v_parts          TEXT[];
  v_unit_code      TEXT;
  v_unit           location_units%ROWTYPE;
  v_node_id        UUID := NULL;
  v_part           TEXT;
  v_full_path      TEXT;
  v_ref_id         UUID;
BEGIN
  v_parts     := string_to_array(p_code, '-');
  v_unit_code := v_parts[1];

  -- resolve unit
  SELECT * INTO v_unit
  FROM location_units
  WHERE site_id = p_site_id AND code = v_unit_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit code % not found for this site', v_unit_code;
  END IF;

  v_full_path := v_unit.name;

  -- walk remaining code segments down the template tree
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

    SELECT v_full_path || ' > ' || name
    INTO v_full_path
    FROM location_template_nodes
    WHERE id = v_node_id;
  END LOOP;

  -- upsert into location_references (the cache)
  INSERT INTO location_references
    (site_id, unit_id, template_node_id, full_path, full_code)
  VALUES
    (p_site_id, v_unit.id, v_node_id, v_full_path, p_code)
  ON CONFLICT (unit_id, template_node_id)
  DO NOTHING
  RETURNING id INTO v_ref_id;

  -- if row already existed, fetch its id
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
-- INDEXES
-- =============================================================================

-- Sites
CREATE INDEX idx_sites_code
  ON sites(code);

-- Items
CREATE INDEX idx_items_code
  ON items(code);
CREATE INDEX idx_items_category
  ON items(category_id);

-- Location units
CREATE INDEX idx_location_units_site
  ON location_units(site_id);
CREATE INDEX idx_location_units_site_code
  ON location_units(site_id, code);

-- Location template nodes
CREATE INDEX idx_template_nodes_template
  ON location_template_nodes(template_id);
CREATE INDEX idx_template_nodes_parent
  ON location_template_nodes(parent_id);

-- Location references
CREATE INDEX idx_location_refs_site
  ON location_references(site_id);
CREATE INDEX idx_location_refs_unit
  ON location_references(unit_id);
CREATE INDEX idx_location_refs_full_code
  ON location_references(site_id, full_code);
CREATE INDEX idx_location_refs_fts
  ON location_references USING gin(to_tsvector('english', full_path));

-- Inventory transactions
CREATE INDEX idx_txn_site_item
  ON inventory_transactions(site_id, item_id);
CREATE INDEX idx_txn_type
  ON inventory_transactions(txn_type);
CREATE INDEX idx_txn_date
  ON inventory_transactions(entry_date);
CREATE INDEX idx_txn_voided
  ON inventory_transactions(is_voided);
CREATE INDEX idx_txn_from_party
  ON inventory_transactions(from_party_id);
CREATE INDEX idx_txn_to_party
  ON inventory_transactions(to_party_id);
CREATE INDEX idx_txn_to_location
  ON inventory_transactions(to_location_id);


-- =============================================================================
-- AUTH & RBAC
-- Supabase Auth manages signup/login via auth.users.
-- profiles extends auth.users with role and status.
-- site_user_access controls which sites each user can access.
-- role_permissions defines what each role can do per module.
-- can_user() is the single permission check function used everywhere.
-- =============================================================================

-- Roles — fixed hierarchy
CREATE TABLE roles (
  id          TEXT PRIMARY KEY,  -- 'SUPER_ADMIN', 'ADMIN', etc.
  label       TEXT NOT NULL,
  description TEXT,
  level       INTEGER NOT NULL   -- 1=highest privilege, 5=lowest
                                 -- prevents lower roles managing higher ones
);

INSERT INTO roles (id, label, level, description) VALUES
  ('SUPER_ADMIN',   'Super Admin',   1, 'Full access to everything. Manages all sites and users.'),
  ('ADMIN',         'Admin',         2, 'Full access on assigned sites. Can manage users on those sites.'),
  ('STORE_MANAGER', 'Store Manager', 3, 'Inventory read/write on assigned sites.'),
  ('SITE_ENGINEER', 'Site Engineer', 4, 'DPR read/write, inventory read on assigned sites.'),
  ('VIEWER',        'Viewer',        5, 'Read-only on assigned sites and modules.');


-- Modules — one row per feature area
-- Add a new module here when you build it. Permissions follow automatically.
CREATE TABLE modules (
  id    TEXT PRIMARY KEY,  -- 'INVENTORY', 'DPR', 'LABOUR', 'LOCATION', 'REPORTS'
  label TEXT NOT NULL
);

INSERT INTO modules (id, label) VALUES
  ('INVENTORY', 'Inventory'),
  ('DPR',       'Daily Progress Report'),
  ('LABOUR',    'Labour Management'),
  ('LOCATION',  'Location Master'),
  ('REPORTS',   'Reports & Analytics');


-- Actions — what operations are possible
CREATE TABLE actions (
  id    TEXT PRIMARY KEY,  -- 'VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'
  label TEXT NOT NULL
);

INSERT INTO actions (id, label) VALUES
  ('VIEW',   'View'),
  ('CREATE', 'Create'),
  ('EDIT',   'Edit'),
  ('DELETE', 'Delete'),
  ('EXPORT', 'Export');


-- Role permission matrix — global defaults per role × module × action
-- Site-level overrides handled in site_user_permission_overrides
CREATE TABLE role_permissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id   TEXT NOT NULL REFERENCES roles(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  action_id TEXT NOT NULL REFERENCES actions(id),

  UNIQUE (role_id, module_id, action_id)
);

-- SUPER_ADMIN and ADMIN get everything
INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'SUPER_ADMIN', m.id, a.id FROM modules m CROSS JOIN actions a;

INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'ADMIN', m.id, a.id FROM modules m CROSS JOIN actions a;

-- STORE_MANAGER
INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('STORE_MANAGER', 'INVENTORY', 'VIEW'),
  ('STORE_MANAGER', 'INVENTORY', 'CREATE'),
  ('STORE_MANAGER', 'INVENTORY', 'EDIT'),
  ('STORE_MANAGER', 'INVENTORY', 'EXPORT'),
  ('STORE_MANAGER', 'REPORTS',   'VIEW');

-- SITE_ENGINEER
INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('SITE_ENGINEER', 'DPR',       'VIEW'),
  ('SITE_ENGINEER', 'DPR',       'CREATE'),
  ('SITE_ENGINEER', 'DPR',       'EDIT'),
  ('SITE_ENGINEER', 'INVENTORY', 'VIEW'),
  ('SITE_ENGINEER', 'LABOUR',    'VIEW'),
  ('SITE_ENGINEER', 'REPORTS',   'VIEW');

-- VIEWER gets VIEW on all modules
INSERT INTO role_permissions (role_id, module_id, action_id)
SELECT 'VIEWER', m.id, 'VIEW' FROM modules m;


-- =============================================================================
-- USER PROFILES
-- Extends Supabase auth.users. One row per user.
-- Never modify auth.users directly — Supabase owns that table.
-- =============================================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role_id     TEXT NOT NULL REFERENCES roles(id) DEFAULT 'VIEWER',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VIEWER'  -- default role; admin assigns correct role after signup
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =============================================================================
-- SITE ACCESS CONTROL
-- Controls which sites a user can access and at what role level.
-- SUPER_ADMIN bypasses this — they see all sites always (enforced in can_user).
-- role_id here can differ from profiles.role_id for site-specific demotion.
-- e.g. ADMIN globally but only VIEWER on one sensitive site.
-- =============================================================================

CREATE TABLE site_user_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES roles(id),
  granted_at  TIMESTAMPTZ DEFAULT now(),
  granted_by  UUID REFERENCES profiles(id),

  UNIQUE (site_id, user_id)
);


-- Per-site per-user module permission overrides
-- Use when a user needs non-standard access on one specific site
-- e.g. STORE_MANAGER who also needs DPR CREATE on one site only
-- granted = true → explicitly grant | granted = false → explicitly revoke
CREATE TABLE site_user_permission_overrides (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id UUID NOT NULL REFERENCES site_user_access(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id),
  action_id TEXT NOT NULL REFERENCES actions(id),
  granted   BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (access_id, module_id, action_id)
);


-- =============================================================================
-- PERMISSION CHECK FUNCTION
-- Single source of truth for all permission checks.
-- Used by RLS policies and can be called directly from application code.
--
-- Logic:
--   1. Inactive users → always false
--   2. SUPER_ADMIN → always true
--   3. No site access row → false
--   4. Site-level override exists → use it (true or false)
--   5. Fall back to role_permissions defaults
-- =============================================================================

CREATE OR REPLACE FUNCTION can_user(
  p_user_id   UUID,
  p_site_id   UUID,
  p_module_id TEXT,
  p_action_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role_id   TEXT;
  v_access_id UUID;
  v_override  BOOLEAN;
  v_permitted BOOLEAN;
BEGIN
  -- get user's global role; reject inactive users
  SELECT role_id INTO v_role_id
  FROM profiles
  WHERE id = p_user_id AND is_active = true;

  IF NOT FOUND THEN RETURN false; END IF;

  -- SUPER_ADMIN bypasses all site and module checks
  IF v_role_id = 'SUPER_ADMIN' THEN RETURN true; END IF;

  -- check site access exists; get site-specific role
  SELECT id, role_id INTO v_access_id, v_role_id
  FROM site_user_access
  WHERE user_id = p_user_id AND site_id = p_site_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- check for explicit site-level module override first
  SELECT granted INTO v_override
  FROM site_user_permission_overrides
  WHERE access_id = v_access_id
    AND module_id = p_module_id
    AND action_id = p_action_id;

  IF FOUND THEN RETURN v_override; END IF;

  -- fall back to role default permissions
  SELECT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role_id   = v_role_id
      AND module_id = p_module_id
      AND action_id = p_action_id
  ) INTO v_permitted;

  RETURN v_permitted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Enforced at DB level — no application code can bypass these.
-- =============================================================================

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_references    ENABLE ROW LEVEL SECURITY;

-- Inventory SELECT — requires VIEW permission
CREATE POLICY "inventory_select" ON inventory_transactions
  FOR SELECT USING (
    can_user(auth.uid(), site_id, 'INVENTORY', 'VIEW')
  );

-- Inventory INSERT — requires CREATE permission
CREATE POLICY "inventory_insert" ON inventory_transactions
  FOR INSERT WITH CHECK (
    can_user(auth.uid(), site_id, 'INVENTORY', 'CREATE')
  );

-- Inventory UPDATE — requires EDIT permission
CREATE POLICY "inventory_update" ON inventory_transactions
  FOR UPDATE USING (
    can_user(auth.uid(), site_id, 'INVENTORY', 'EDIT')
  );

-- Hard deletes blocked for everyone — use is_voided instead
CREATE POLICY "inventory_no_delete" ON inventory_transactions
  FOR DELETE USING (false);

-- Location units — scoped to sites user has access to
CREATE POLICY "location_units_select" ON location_units
  FOR SELECT USING (
    can_user(auth.uid(), site_id, 'LOCATION', 'VIEW')
  );

-- Location references — scoped to sites user has access to
CREATE POLICY "location_refs_select" ON location_references
  FOR SELECT USING (
    can_user(auth.uid(), site_id, 'LOCATION', 'VIEW')
  );


-- =============================================================================
-- AUTH & RBAC INDEXES
-- =============================================================================

CREATE INDEX idx_profiles_role
  ON profiles(role_id);

CREATE INDEX idx_profiles_active
  ON profiles(is_active);

CREATE INDEX idx_site_access_user
  ON site_user_access(user_id);

CREATE INDEX idx_site_access_site
  ON site_user_access(site_id);

CREATE INDEX idx_overrides_access
  ON site_user_permission_overrides(access_id);


-- =============================================================================
-- SEEDING SCRIPT FOR A NEW SITE
-- Run this when onboarding a new project.
-- Replace UUIDs and values as appropriate.
-- =============================================================================

-- Step 1: Insert site
-- INSERT INTO sites (name, code, type) VALUES ('RGIPT Sivasagar', 'RGIPT-SIV', 'hostel');

-- Step 2: Insert template (once globally, reuse across sites)
-- INSERT INTO location_templates (id, name) VALUES ('...uuid...', 'G+4 Hostel');
-- INSERT INTO location_template_nodes (...) VALUES (...);

-- Step 3: Bulk insert units in one query
-- INSERT INTO location_units (site_id, name, code, type, template_id)
-- SELECT 'site-uuid', 'Villa ' || n, n::TEXT, 'villa', 'template-uuid'
-- FROM generate_series(1, 50) AS n;

-- Step 4: location_references created automatically on first use via resolve_location()

-- Step 5: Grant site access to users
-- INSERT INTO site_user_access (site_id, user_id, role_id, granted_by)
-- VALUES ('site-uuid', 'user-uuid', 'STORE_MANAGER', 'your-uuid');

-- Step 6: Optional module overrides
-- INSERT INTO site_user_permission_overrides (access_id, module_id, action_id, granted)
-- VALUES ('access-uuid', 'DPR', 'CREATE', true);
