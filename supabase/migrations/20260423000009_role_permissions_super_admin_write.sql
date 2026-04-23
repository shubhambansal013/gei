-- 20260423000009_role_permissions_super_admin_write.sql
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
