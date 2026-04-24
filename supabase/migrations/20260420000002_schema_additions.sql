-- 20260420000002_schema_additions.sql
-- Adds: reorder_level on items, rate on issues, updated_at on mutable tables.

ALTER TABLE items
  ADD COLUMN reorder_level NUMERIC CHECK (reorder_level IS NULL OR reorder_level >= 0);

ALTER TABLE issues
  ADD COLUMN rate NUMERIC CHECK (rate IS NULL OR rate >= 0);

ALTER TABLE purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE issues    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
