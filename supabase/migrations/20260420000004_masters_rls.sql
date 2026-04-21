-- 20260420000004_masters_rls.sql
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
