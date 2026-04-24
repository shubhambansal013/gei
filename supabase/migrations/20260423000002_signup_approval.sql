-- 20260423000002_signup_approval.sql
-- Security Wave 1 — Issue #12.
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
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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


-- -----------------------------------------------------------------------
-- Close the masters SELECT hole. The original policies from
-- 20260420000004 let ANY authenticated user read items/parties. Now
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
