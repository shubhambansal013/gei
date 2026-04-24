-- 20260420000003_audit_log.sql
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
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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


CREATE TRIGGER trg_purchases_audit
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();

CREATE TRIGGER trg_issues_audit
  AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_inventory_edit();
