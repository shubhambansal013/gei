-- 20260423000008_units_admin_write.sql
-- `units` is a tenant-wide reference master. Any authenticated user
-- needs SELECT so the unit dropdown works in every entry form; only
-- admins (SUPER_ADMIN globally or ADMIN on any site — i.e. the same
-- bar as other masters) may mutate it. Mirrors the policy shape in
-- 20260420000004_masters_rls.sql.

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_all" ON units
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "units_write_admin" ON units
  FOR ALL USING (is_admin_anywhere(auth.uid()))
  WITH CHECK (is_admin_anywhere(auth.uid()));
