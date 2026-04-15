-- =============================================================================
-- schema.sql
-- GEI
-- Last updated: 2026-04-14
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
  id       TEXT PRIMARY KEY,  -- canonical code: "mtr", "nos", "kg"
  label    TEXT NOT NULL,     -- display label: "Metre", "Numbers"
  category TEXT                -- grouping: "length", "volume", "weight", "count"
);

INSERT INTO units (id, label, category) VALUES
  ('nos',  'Numbers',       'count'),
  ('mtr',  'Metre',         'length'),
  ('sqft', 'Square Feet',   'area'),
  ('sqm',  'Square Metre',  'area'),
  ('cum',  'Cubic Metre',   'volume'),
  ('kg',   'Kilogram',      'weight'),
  ('mt',   'Metric Tonne',  'weight'),
  ('ltr',  'Litre',         'volume'),
  ('set',  'Set',           'count'),
  ('pcs',  'Pieces',        'count'),
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
  id    TEXT PRIMARY KEY,  -- "electrical", "civil", "plumbing"
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
  id    TEXT PRIMARY KEY,  -- "villa", "floor", "room", "area"
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
  id    TEXT PRIMARY KEY,  -- "supplier", "contractor", "subcontractor"
  label TEXT NOT NULL,
  is_voided         BOOLEAN DEFAULT false
);

INSERT INTO party_types (id, label) VALUES
  ('supplier',      'Supplier'),
  ('contractor',    'Contractor'),
  ('subcontractor', 'Sub-Contractor'),
  ('client',        'Client'),
  ('consultant',    'Consultant');

-- =============================================================================
-- SITES
-- =============================================================================

CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  type        TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- PARTIES
-- =============================================================================

CREATE TABLE parties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL REFERENCES party_types(id),
  gstin       TEXT,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  is_voided         BOOLEAN DEFAULT false
);

-- =============================================================================
-- ITEMS MASTER
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
  is_voided         BOOLEAN DEFAULT false,
  UNIQUE (site_id, code)
);

CREATE TABLE location_references (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  unit_id           UUID NOT NULL REFERENCES location_units(id),
  template_node_id  UUID REFERENCES location_template_nodes(id),
  full_path         TEXT NOT NULL,
  full_code         TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (unit_id, template_node_id)
);

CREATE TABLE site_location_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id),
  template_id   UUID REFERENCES location_templates(id),
  unit_type     TEXT REFERENCES location_types(id),
  min_depth     INTEGER DEFAULT 1,
  max_depth     INTEGER,
  enforce       BOOLEAN DEFAULT false
);

-- =============================================================================
-- INVENTORY TRANSACTIONS
-- =============================================================================

CREATE TABLE inventory_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  item_id           UUID NOT NULL REFERENCES items(id),
  quantity          NUMERIC NOT NULL CHECK (quantity > 0),

  unit_rate         NUMERIC CHECK (unit_rate >= 0),
  gst_percent       NUMERIC DEFAULT 0 CHECK (gst_percent >= 0),
  gst_amount        NUMERIC GENERATED ALWAYS AS
                    (ROUND(quantity * unit_rate * gst_percent / 100, 2)) STORED,
  total_amount      NUMERIC GENERATED ALWAYS AS
                    (ROUND(quantity * unit_rate +
                     quantity * unit_rate * gst_percent / 100, 2)) STORED,

  txn_type          TEXT NOT NULL REFERENCES txn_types(id),

  -- FROM party
  from_type         txn_party_type NOT NULL,
  from_party_id     UUID REFERENCES parties(id),
  from_location_id  UUID REFERENCES location_references(id),
  from_site_id      UUID REFERENCES sites(id),

  -- TO party
  to_type           txn_party_type NOT NULL,
  to_party_id       UUID REFERENCES parties(id),
  to_location_id    UUID REFERENCES location_references(id),
  to_site_id        UUID REFERENCES sites(id),

  remarks           TEXT,
  entry_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  created_by        TEXT,

  is_voided         BOOLEAN DEFAULT false,
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT
);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE VIEW item_weighted_avg_cost AS
SELECT
  site_id,
  item_id,
  ROUND(
    SUM(quantity * unit_rate) / NULLIF(SUM(quantity), 0),
    2
  ) AS weighted_avg_rate
FROM inventory_transactions
WHERE txn_type   = 'inward'
  AND is_voided  = false
  AND unit_rate  IS NOT NULL
GROUP BY site_id, item_id;

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

CREATE OR REPLACE FUNCTION resolve_location(
  p_site_id  UUID,
  p_code     TEXT
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

    SELECT v_full_path || ' > ' || name
    INTO v_full_path
    FROM location_template_nodes
    WHERE id = v_node_id;
  END LOOP;

  INSERT INTO location_references
    (site_id, unit_id, template_node_id, full_path, full_code)
  VALUES
    (p_site_id, v_unit.id, v_node_id, v_full_path, p_code)
  ON CONFLICT (unit_id, template_node_id)
  DO NOTHING
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
-- INDEXES
-- =============================================================================

CREATE INDEX idx_sites_code ON sites(code);
CREATE INDEX idx_items_code ON items(code);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_location_units_site ON location_units(site_id);
CREATE INDEX idx_location_units_site_code ON location_units(site_id, code);
CREATE INDEX idx_template_nodes_template ON location_template_nodes(template_id);
CREATE INDEX idx_template_nodes_parent ON location_template_nodes(parent_id);
CREATE INDEX idx_location_refs_site ON location_references(site_id);
CREATE INDEX idx_location_refs_unit ON location_references(unit_id);
CREATE INDEX idx_location_refs_full_code ON location_references(site_id, full_code);
CREATE INDEX idx_location_refs_fts ON location_references USING gin(to_tsvector('english', full_path));
CREATE INDEX idx_txn_site_item ON inventory_transactions(site_id, item_id);
CREATE INDEX idx_txn_type ON inventory_transactions(txn_type);
CREATE INDEX idx_txn_date ON inventory_transactions(entry_date);
CREATE INDEX idx_txn_voided ON inventory_transactions(is_voided);
CREATE INDEX idx_txn_from_party ON inventory_transactions(from_party_id);
CREATE INDEX idx_txn_to_party ON inventory_transactions(to_party_id);
CREATE INDEX idx_txn_to_location ON inventory_transactions(to_location_id);
