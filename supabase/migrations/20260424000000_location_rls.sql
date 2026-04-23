-- 20260424000000_location_rls.sql
-- Security Wave 1 — Issue #1: RLS for location templates and types.

ALTER TABLE location_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_template_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_types          ENABLE ROW LEVEL SECURITY;

-- location_templates
CREATE POLICY "location_templates_select" ON location_templates
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "location_templates_write_admin" ON location_templates
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

-- location_template_nodes
CREATE POLICY "location_template_nodes_select" ON location_template_nodes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "location_template_nodes_write_admin" ON location_template_nodes
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));

-- location_types
CREATE POLICY "location_types_select" ON location_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "location_types_write_admin" ON location_types
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
