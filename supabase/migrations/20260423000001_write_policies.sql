-- 20260423000001_write_policies.sql
-- Security Wave 1 — Issue #1: RLS-enabled tables without write policies.
--
-- Before this migration:
--   * `location_units` and `location_references` had RLS enabled with
--     SELECT-only policies, so even SUPER_ADMIN INSERT/UPDATE/DELETE
--     got SQLSTATE 42501.
--   * `site_user_permission_overrides` had no RLS at all — a plain
--     authenticated user could read or edit anyone's overrides.
--
-- Fix: enable RLS on overrides; add admin-only write policies to all
-- three. Reuses `is_admin_anywhere(auth.uid())` from 20260420000004.

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
